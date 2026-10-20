//! Runs the full game loop across all four contracts in one `Env`:
//! claim → mint → mine → build → deploy → move → attack.
//!
//! This is the in-process version of the manual testnet session, so a drifting
//! cross-contract call signature fails `cargo test` instead of a live run (#127).

use battle::{BattleContract, BattleContractClient};
use fleet::{FleetContract, FleetContractClient, UnitType, MOVE_COOLDOWN_SECONDS};
use galaxy_map::{GalaxyMapContract, GalaxyMapContractClient};
use resources::{
    ResourceType, ResourcesContract, ResourcesContractClient, MINING_PERIOD_SECONDS,
};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{vec, Address, Env};

/// Side length of the grid; 3×3 gives systems 0–8.
const GRID_SIZE: u32 = 3;

/// The four deployed contracts, wired the way the deploy script wires them.
struct World<'a> {
    galaxy: GalaxyMapContractClient<'a>,
    resources: ResourcesContractClient<'a>,
    fleet: FleetContractClient<'a>,
    battle: BattleContractClient<'a>,
}

/// Registers all four contracts in `env` and runs their `initialize` calls.
fn deploy_world(env: &Env) -> World<'_> {
    env.mock_all_auths();
    let admin = Address::generate(env);

    let galaxy_id = env.register(GalaxyMapContract, ());
    let resources_id = env.register(ResourcesContract, ());
    let fleet_id = env.register(FleetContract, ());
    let battle_id = env.register(BattleContract, ());

    // Hands asset admin to the resources contract, so it can mint and burn on players' behalf.
    let iron = env.register_stellar_asset_contract_v2(resources_id.clone());
    let energy = env.register_stellar_asset_contract_v2(resources_id.clone());
    let plasma = env.register_stellar_asset_contract_v2(resources_id.clone());

    let galaxy = GalaxyMapContractClient::new(env, &galaxy_id);
    let resources = ResourcesContractClient::new(env, &resources_id);
    let fleet = FleetContractClient::new(env, &fleet_id);
    let battle = BattleContractClient::new(env, &battle_id);

    galaxy.initialize(&admin, &GRID_SIZE);
    resources.initialize(&admin, &iron.address(), &energy.address(), &plasma.address());
    resources.set_galaxy_map(&admin, &galaxy_id);
    fleet.initialize(&admin, &resources_id, &galaxy_id);
    battle.initialize(&admin, &galaxy_id, &fleet_id);
    galaxy.set_battle_contract(&admin, &battle_id);
    fleet.set_battle_contract(&admin, &battle_id);

    World {
        galaxy,
        resources,
        fleet,
        battle,
    }
}

#[test]
fn full_loop_runs_across_all_four_contracts_in_one_env() {
    let env = Env::default();
    let world = deploy_world(&env);

    let attacker = Address::generate(&env);
    let defender = Address::generate(&env);
    let home = 0u32; // the attacker claims and mines this system
    let staging = 1u32; // the fleet moves here, adjacent to home
    let target = 2u32; // the defender holds this, adjacent to staging

    // Claim: the attacker takes home at ledger time 0.
    world.galaxy.claim_system(&attacker, &home);

    // Setup: starting balances. Trustlines are not needed here, because the test
    // asset contracts are Soroban-native, so minting is the funding step.
    world.resources.mint(&attacker, &ResourceType::Iron, &1_000);
    world.resources.mint(&attacker, &ResourceType::Energy, &1_000);
    world.resources.mint(&defender, &ResourceType::Iron, &100);
    world.resources.mint(&defender, &ResourceType::Energy, &100);

    // Mine: two full periods have passed, so home (yield 10, Iron) pays 2 × 10.
    env.ledger().set_timestamp(2 * MINING_PERIOD_SECONDS);
    assert_eq!(world.resources.mine(&attacker, &home), 20);

    // Build: 4 Dreadnoughts cost 600 Iron and 400 Energy. The defender builds 1 Scout.
    world.fleet.build_unit(&attacker, &UnitType::Dreadnought, &4);
    world.fleet.build_unit(&defender, &UnitType::Scout, &1);

    // Deploy the attacker's fleet at home.
    world.fleet.deploy_fleet(&attacker, &home);

    // Move: the cooldown runs from deployment, so wait it out before moving.
    env.ledger().set_timestamp(2 * MINING_PERIOD_SECONDS + MOVE_COOLDOWN_SECONDS);
    world.fleet.move_fleet(&attacker, &staging);

    // The defender claims the target after the fleet has moved.
    world.galaxy.claim_system(&defender, &target);

    // Attack: 4 Dreadnoughts (attack 120) against 1 Scout plus system defense 7.
    // The defender's only unit dies in round 1 whatever the PRNG rolls.
    let battle_id = world.battle.resolve_battle(&attacker, &defender, &target);
    let result = world.battle.get_battle(&battle_id);
    assert_eq!(result.winner, attacker);
    assert_eq!(result.rounds, 1);

    // The attack reached every contract it touches.
    // Galaxy map: the conquered system changed hands and joined the attacker's list.
    assert_eq!(world.galaxy.get_system(&target).owner, Some(attacker.clone()));
    assert_eq!(
        world.galaxy.get_player_systems(&attacker),
        vec![&env, home, target]
    );
    // Fleet: the defender's Scout was removed through apply_battle_losses.
    assert_eq!(world.fleet.get_fleet(&defender).scouts, 0);
    // Fleet: the attacker took no losses.
    assert_eq!(world.fleet.get_fleet(&attacker).dreadnoughts, 4);

    // Resources: 1000 + 20 mined − 600 spent on Dreadnoughts = 420 Iron.
    assert_eq!(world.resources.balance(&attacker, &ResourceType::Iron), 420);
    // Resources: 1000 − 400 spent on Dreadnoughts = 600 Energy.
    assert_eq!(world.resources.balance(&attacker, &ResourceType::Energy), 600);
}
