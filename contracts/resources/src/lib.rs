#![no_std]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, symbol_short, token, Address, Env,
    Symbol, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    IronToken,
    EnergyToken,
    PlasmaToken,
    Initialized,
    GalaxyMap,
    LastMined(u32),
    NextTradeOfferId,
    OpenTradeOffers,
    TradeOffer(u64),
    Paused,
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResourceType {
    Iron,
    Energy,
    Plasma,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TradeStatus {
    Open,
    Accepted,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeOffer {
    pub offer_id: u64,
    pub maker: Address,
    pub offer_resource: ResourceType,
    pub offer_amount: i128,
    pub want_resource: ResourceType,
    pub want_amount: i128,
    pub created_at: u64,
    pub expires_at: u64,
    pub status: TradeStatus,
}

const MAX_TRADE_PAGE_SIZE: u32 = 50;

/// Mirrors galaxy_map::StarSystem field-for-field. Its ResourceType has the
/// same variants in the same order as ours, so it encodes identically.
#[contracttype]
#[derive(Clone, Debug)]
pub struct StarSystem {
    pub owner: Option<Address>,
    pub coord_x: u32,
    pub coord_y: u32,
    pub resource_type: ResourceType,
    pub resource_yield: u32,
    pub defense_rating: u32,
    pub last_claimed: u64,
    pub upgrade_level: u32,
}

/// The slice of the galaxy-map contract this contract depends on.
#[contractclient(name = "GalaxyMapClient")]
pub trait GalaxyMapInterface {
    fn get_system(env: Env, system_id: u32) -> StarSystem;
    fn upgrade_system(env: Env, player: Address, system_id: u32);
    fn get_grid_size(env: Env) -> u32;
}

/// Each full period a system is held pays its `resource_yield` once.
pub const MINING_PERIOD_SECONDS: u64 = 300;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct ResourcesContract;

#[contractimpl]
impl ResourcesContract {
    /// Initializes the resources contract with the addresses of the three
    /// Stellar Asset Contract (SAC) tokens backing `Iron`, `Energy`, and `Plasma`.
    /// Must be called once before any other contract function is invoked.
    ///
    /// # Parameters
    /// - `env`: The Soroban execution environment.
    /// - `admin`: The administrator address stored for privileged operations (`mint`, `set_galaxy_map`).
    /// - `iron_token`: The contract address of the `IRON` Stellar Asset Contract.
    /// - `energy_token`: The contract address of the `NRGY` Stellar Asset Contract.
    /// - `plasma_token`: The contract address of the `PLSM` Stellar Asset Contract.
    ///
    /// # Returns
    /// `()` — writes the admin and token addresses to instance storage and marks the contract initialized.
    ///
    /// # Authorization
    /// Requires authorization from `admin` (`admin.require_auth()`).
    ///
    /// # Panics
    /// - Panics with `"already initialized"` if `initialize` has already been called on this contract.
    pub fn initialize(
        env: Env,
        admin: Address,
        iron_token: Address,
        energy_token: Address,
        plasma_token: Address,
    ) {
        admin.require_auth();

        let already_init: bool = env
            .storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);

        if already_init {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::IronToken, &iron_token);
        env.storage().instance().set(&DataKey::EnergyToken, &energy_token);
        env.storage().instance().set(&DataKey::PlasmaToken, &plasma_token);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    /// Mints `amount` of `resource` directly to `to` via the underlying Stellar Asset Contract
    /// and publishes a `("minted", to)` event with payload `(resource, amount)`.
    ///
    /// # Parameters
    /// - `env`: The Soroban execution environment.
    /// - `to`: The recipient player address (must hold a trustline to the underlying classic asset).
    /// - `resource`: Which resource token to mint ([`ResourceType::Iron`], [`ResourceType::Energy`], or [`ResourceType::Plasma`]).
    /// - `amount`: The quantity of tokens to mint (128-bit signed integer, must be non-negative).
    ///
    /// # Returns
    /// `()` — mints the tokens in-place on the corresponding Stellar Asset Contract.
    ///
    /// # Authorization
    /// Requires authorization from the contract `admin` (`admin.require_auth()`), AND requires the
    /// admin (or this contract, if asset administration was transferred) to be authorized by the
    /// underlying Stellar Asset Contract.
    ///
    /// # Panics
    /// - Panics with `"not initialized"` if [`ResourcesContract::initialize`] has not been called.
    /// - Panics in the underlying Stellar Asset Contract if `amount < 0`, if `to` lacks a trustline,
    ///   or if the caller is not the asset administrator.
    pub fn mint(env: Env, to: Address, resource: ResourceType, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");

        admin.require_auth();
        require_not_paused(&env);

        let token_addr = Self::token_addr(&env, &resource);
        let client = token::StellarAssetClient::new(&env, &token_addr);
        client.mint(&to, &amount);

        env.events()
            .publish((symbol_short!("minted"), to), (resource, amount));
    }

    /// Registers the `galaxy-map` contract address that [`ResourcesContract::mine`] queries to verify
    /// system ownership, `last_claimed` timestamp, resource type, and yield.
    ///
    /// # Parameters
    /// - `env`: The Soroban execution environment.
    /// - `caller`: The address invoking this function (must match the stored `admin`).
    /// - `galaxy_map`: The deployed contract address of the `galaxy-map` contract.
    ///
    /// # Returns
    /// `()` — stores `galaxy_map` in instance storage under [`DataKey::GalaxyMap`].
    ///
    /// # Authorization
    /// Requires authorization from `caller` (`caller.require_auth()`), who must be the contract `admin`.
    ///
    /// # Panics
    /// - Panics with `"not initialized"` if [`ResourcesContract::initialize`] has not been called.
    /// - Panics with `"caller is not the admin"` if `caller` does not match the stored `admin` address.
    pub fn set_galaxy_map(env: Env, caller: Address, galaxy_map: Address) {
        caller.require_auth();
        require_not_paused(&env);
        verify_caller_is_admin(&env, &caller);
        env.storage().instance().set(&DataKey::GalaxyMap, &galaxy_map);
    }

    /// Mines accrued resources for `system_id`, paying `player` the system's `resource_yield`
    /// for every complete [`MINING_PERIOD_SECONDS`] (300s) elapsed since the system was last
    /// mined or since `player` acquired it (`last_claimed`), whichever is later.
    ///
    /// Advances `LastMined(system_id)` by whole periods only so any partial period carries over,
    /// and publishes a `("mined", player)` event with `(system_id, resource_type, amount)`.
    ///
    /// # Parameters
    /// - `env`: The Soroban execution environment.
    /// - `player`: The address of the system owner claiming mined resources.
    /// - `system_id`: The ID of the star system to mine in the registered `galaxy-map` contract.
    ///
    /// # Returns
    /// The total amount of resources minted (`i128`), equal to `full_periods * system.resource_yield`.
    ///
    /// # Authorization
    /// Requires only `player.require_auth()` from the caller. Note: the three Stellar Asset Contracts
    /// must have their admin set to this `resources` contract (`set_admin`) so it can mint on the
    /// player's behalf without requiring the deployer's signature.
    ///
    /// # Panics
    /// - Panics with `"galaxy map not set"` if [`ResourcesContract::set_galaxy_map`] has not been called.
    /// - Panics with `"not initialized"` if [`ResourcesContract::initialize`] has not been called.
    /// - Panics if `system_id` does not exist in the `galaxy-map` contract (`"system not found"`).
    /// - Panics with `"player does not own this system"` if `system.owner` is not `Some(player)`.
    /// - Panics with `"nothing to mine yet"` if fewer than [`MINING_PERIOD_SECONDS`] (300s) have
    ///   elapsed since `max(last_mined, system.last_claimed)`.
    /// - Panics in the underlying Stellar Asset Contract if this contract is not the asset admin
    ///   or if `player` has not established a trustline for the system's resource asset.
    pub fn mine(env: Env, player: Address, system_id: u32) -> i128 {
        player.require_auth();
        require_not_paused(&env);

        let system = fetch_galaxy_map_client(&env).get_system(&system_id);
        verify_player_owns_system(&system, &player);

        let now = env.ledger().timestamp();
        let start = mining_start(&env, system_id, system.last_claimed);
        let periods = now.saturating_sub(start) / MINING_PERIOD_SECONDS;
        if periods == 0 {
            panic!("nothing to mine yet");
        }

        let amount = periods as i128 * system.resource_yield as i128;
        let token_addr = Self::token_addr(&env, &system.resource_type);
        token::StellarAssetClient::new(&env, &token_addr).mint(&player, &amount);

        // Advance by whole periods only, so a partial period carries over.
        env.storage()
            .persistent()
            .set(&DataKey::LastMined(system_id), &(start + periods * MINING_PERIOD_SECONDS));

        env.events().publish(
            (symbol_short!("mined"), player),
            (system_id, system.resource_type, amount),
        );
        amount
    }

    /// Burns `amount` of `resource` from `from`'s token balance via the underlying
    /// Stellar Asset Contract and publishes a `("burned", from)` event with `(resource, amount)`.
    ///
    /// Used by the `fleet` contract when a player spends Iron and Energy to build units.
    ///
    /// # Parameters
    /// - `env`: The Soroban execution environment.
    /// - `from`: The player address whose tokens will be burned.
    /// - `resource`: Which resource token to burn ([`ResourceType::Iron`], [`ResourceType::Energy`], or [`ResourceType::Plasma`]).
    /// - `amount`: The quantity of tokens to burn (`i128`, must be non-negative and `<=` balance).
    ///
    /// # Returns
    /// `()` — burns the tokens in-place on the corresponding Stellar Asset Contract.
    ///
    /// # Authorization
    /// Requires authorization from `from` (`from.require_auth()`), including for the sub-invocation
    /// to `TokenClient::burn` on the underlying Stellar Asset Contract.
    ///
    /// # Panics
    /// - Panics with `"not initialized"` if [`ResourcesContract::initialize`] has not been called.
    /// - Panics in the underlying Stellar Asset Contract if `from`'s balance is less than `amount`,
    ///   if `amount < 0`, or if `from` lacks a trustline for `resource`.
    pub fn burn(env: Env, from: Address, resource: ResourceType, amount: i128) {
        from.require_auth();
        require_not_paused(&env);

        let token_addr = Self::token_addr(&env, &resource);
        let client = token::TokenClient::new(&env, &token_addr);
        client.burn(&from, &amount);

        env.events()
            .publish((symbol_short!("burned"), from), (resource, amount));
    }

    /// Upgrades a system's defense, costing 100 * (current_level + 1) Plasma.
    ///
    /// Requires the player to own the system and have sufficient Plasma balance.
    pub fn upgrade_system(env: Env, player: Address, system_id: u32) {
        player.require_auth();
        require_not_paused(&env);

        let galaxy_map = fetch_galaxy_map_client(&env);
        let system = galaxy_map.get_system(&system_id);

        verify_player_owns_system(&system, &player);

        let cost = 100i128 * (system.upgrade_level + 1) as i128;
        let balance = Self::balance(env.clone(), player.clone(), ResourceType::Plasma);

        if balance < cost {
            panic!("insufficient plasma balance");
        }

        Self::burn_plasma(&env, &player, cost);
        galaxy_map.upgrade_system(&player, &system_id);

        env.events()
            .publish((symbol_short!("upgraded"), player), (system_id, system.upgrade_level + 1, cost));
    }

    /// Queries and returns `player`'s current balance of `resource` from the underlying
    /// Stellar Asset Contract.
    ///
    /// # Parameters
    /// - `env`: The Soroban execution environment.
    /// - `player`: The player address whose resource balance to query.
    /// - `resource`: Which resource token to query ([`ResourceType::Iron`], [`ResourceType::Energy`], or [`ResourceType::Plasma`]).
    ///
    /// # Returns
    /// The player's current balance as an `i128` (`0` if the player holds no tokens or trustline).
    ///
    /// # Authorization
    /// None — this is a read-only view function.
    ///
    /// # Panics
    /// - Panics with `"not initialized"` if [`ResourcesContract::initialize`] has not been called.
    pub fn balance(env: Env, player: Address, resource: ResourceType) -> i128 {
        let token_addr = Self::token_addr(&env, &resource);
        let client = token::TokenClient::new(&env, &token_addr);
        client.balance(&player)
    }

    pub fn create_trade_offer(
        env: Env,
        maker: Address,
        offer_resource: ResourceType,
        offer_amount: i128,
        want_resource: ResourceType,
        want_amount: i128,
        expires_at: u64,
    ) -> u64 {
        maker.require_auth();
        require_not_paused(&env);
        if offer_amount <= 0 || want_amount <= 0 {
            panic!("trade amounts must be positive");
        }
        if offer_resource == want_resource {
            panic!("trade resources must differ");
        }

        let now = env.ledger().timestamp();
        if expires_at <= now {
            panic!("trade expiry must be in the future");
        }

        let escrow = env.current_contract_address();
        token::TokenClient::new(&env, &Self::token_addr(&env, &offer_resource)).transfer(
            &maker,
            &escrow,
            &offer_amount,
        );

        let next_id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::NextTradeOfferId)
            .unwrap_or(0);
        let offer_id = next_id.checked_add(1).expect("trade offer id overflow");
        let offer = TradeOffer {
            offer_id,
            maker: maker.clone(),
            offer_resource,
            offer_amount,
            want_resource,
            want_amount,
            created_at: now,
            expires_at,
            status: TradeStatus::Open,
        };

        let mut open_offers = Self::open_trade_offer_ids(&env);
        open_offers.push_back(offer_id);
        env.storage()
            .persistent()
            .set(&DataKey::NextTradeOfferId, &offer_id);
        env.storage()
            .persistent()
            .set(&DataKey::TradeOffer(offer_id), &offer);
        env.storage()
            .persistent()
            .set(&DataKey::OpenTradeOffers, &open_offers);
        env.events()
            .publish((Symbol::new(&env, "trade_offered"), maker), offer);
        offer_id
    }

    pub fn accept_trade_offer(env: Env, taker: Address, offer_id: u64) {
        taker.require_auth();
        require_not_paused(&env);
        let mut offer: TradeOffer = env
            .storage()
            .persistent()
            .get(&DataKey::TradeOffer(offer_id))
            .expect("trade offer not found");
        if offer.status != TradeStatus::Open {
            panic!("trade offer is not open");
        }
        if offer.maker == taker {
            panic!("cannot accept own trade offer");
        }
        if env.ledger().timestamp() >= offer.expires_at {
            panic!("trade offer expired");
        }

        let maker = offer.maker.clone();
        let escrow = env.current_contract_address();
        token::TokenClient::new(&env, &Self::token_addr(&env, &offer.want_resource)).transfer(
            &taker,
            &maker,
            &offer.want_amount,
        );
        token::TokenClient::new(&env, &Self::token_addr(&env, &offer.offer_resource)).transfer(
            &escrow,
            &taker,
            &offer.offer_amount,
        );

        offer.status = TradeStatus::Accepted;
        env.storage()
            .persistent()
            .set(&DataKey::TradeOffer(offer_id), &offer);
        Self::remove_open_trade_offer(&env, offer_id);
        env.events().publish(
            (Symbol::new(&env, "trade_accepted"), taker),
            (offer_id, maker),
        );
    }

    pub fn cancel_trade_offer(env: Env, maker: Address, offer_id: u64) {
        maker.require_auth();
        require_not_paused(&env);
        let mut offer: TradeOffer = env
            .storage()
            .persistent()
            .get(&DataKey::TradeOffer(offer_id))
            .expect("trade offer not found");
        if offer.maker != maker {
            panic!("only the maker can cancel");
        }
        if offer.status != TradeStatus::Open {
            panic!("trade offer is not open");
        }

        let escrow = env.current_contract_address();
        token::TokenClient::new(&env, &Self::token_addr(&env, &offer.offer_resource)).transfer(
            &escrow,
            &maker,
            &offer.offer_amount,
        );
        offer.status = TradeStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::TradeOffer(offer_id), &offer);
        Self::remove_open_trade_offer(&env, offer_id);
        env.events()
            .publish((Symbol::new(&env, "trade_cancelled"), maker), offer_id);
    }

    pub fn get_open_trade_offers(env: Env, offset: u32, limit: u32) -> Vec<TradeOffer> {
        if limit > MAX_TRADE_PAGE_SIZE {
            panic!("trade page limit exceeded");
        }
        let open_offers = Self::open_trade_offer_ids(&env);
        let now = env.ledger().timestamp();
        let mut skipped = 0;
        let mut index = 0;
        let mut offers = Vec::new(&env);
        while index < open_offers.len() && offers.len() < limit {
            let offer_id = open_offers
                .get(index)
                .expect("open trade offer index missing");
            let offer: TradeOffer = env
                .storage()
                .persistent()
                .get(&DataKey::TradeOffer(offer_id))
                .expect("trade offer not found");
            if offer.expires_at > now {
                if skipped < offset {
                    skipped += 1;
                } else {
                    offers.push_back(offer);
                }
            }
            index += 1;
        }
        offers
    }

    /// Clears every system's mining timer for a new season. Admin only.
    ///
    /// Sets each timer to now rather than clearing it: `mining_start` falls
    /// back to `last_claimed` when there is no stored timer, so clearing it
    /// would let a system whose ownership survives the reset window re-mine
    /// periods it already collected.
    ///
    /// Actual token balances live on the Stellar Asset Contracts and are not
    /// cleared here: `burn` requires the holder's own authorization, and this
    /// contract has no registry of which players hold tokens to sweep.
    pub fn reset_season(env: Env, caller: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);
        require_not_paused(&env);

        let grid_size = fetch_galaxy_map_client(&env).get_grid_size();
        let total = grid_size * grid_size;
        let now = env.ledger().timestamp();
        let mut id: u32 = 0;
        while id < total {
            env.storage().persistent().set(&DataKey::LastMined(id), &now);
            id += 1;
        }
    }

    // ── Pause ─────────────────────────────────────────────────────────────────

    /// Halts all state-mutating functions. Admin only.
    /// Panics if the contract is already paused.
    pub fn pause(env: Env, caller: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);
        if is_paused(&env) {
            panic!("already paused");
        }
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    /// Re-enables state-mutating functions after a pause. Admin only.
    /// Panics if the contract is not currently paused.
    pub fn unpause(env: Env, caller: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);
        if !is_paused(&env) {
            panic!("not paused");
        }
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn burn_plasma(env: &Env, player: &Address, amount: i128) {
        let token_addr = Self::token_addr(env, &ResourceType::Plasma);
        let client = token::TokenClient::new(env, &token_addr);
        client.burn(player, &amount);
    }

    fn remove_open_trade_offer(env: &Env, offer_id: u64) {
        let mut open_offers = Self::open_trade_offer_ids(env);
        let mut index = 0;
        while index < open_offers.len() {
            if open_offers.get(index) == Some(offer_id) {
                open_offers.remove(index);
                env.storage()
                    .persistent()
                    .set(&DataKey::OpenTradeOffers, &open_offers);
                return;
            }
            index += 1;
        }
        panic!("open trade offer not found");
    }

    fn open_trade_offer_ids(env: &Env) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::OpenTradeOffers)
            .unwrap_or(Vec::new(env))
    }

    fn token_addr(env: &Env, resource: &ResourceType) -> Address {
        match resource {
            ResourceType::Iron => env
                .storage()
                .instance()
                .get(&DataKey::IronToken)
                .expect("not initialized"),
            ResourceType::Energy => env
                .storage()
                .instance()
                .get(&DataKey::EnergyToken)
                .expect("not initialized"),
            ResourceType::Plasma => env
                .storage()
                .instance()
                .get(&DataKey::PlasmaToken)
                .expect("not initialized"),
        }
    }
}

// ── Mining helpers ────────────────────────────────────────────────────────────

fn verify_caller_is_admin(env: &Env, caller: &Address) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized");
    if *caller != admin {
        panic!("caller is not the admin");
    }
}

fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

fn require_not_paused(env: &Env) {
    if is_paused(env) {
        panic!("contract is paused");
    }
}

fn fetch_galaxy_map_client(env: &Env) -> GalaxyMapClient<'_> {
    let addr: Address = env
        .storage()
        .instance()
        .get(&DataKey::GalaxyMap)
        .expect("galaxy map not set");
    GalaxyMapClient::new(env, &addr)
}

fn verify_player_owns_system(system: &StarSystem, player: &Address) {
    if system.owner.as_ref() != Some(player) {
        panic!("player does not own this system");
    }
}

/// Yield accrues from the later of the last mine and when the current owner
/// acquired the system, so a new owner can't collect a previous owner's yield.
fn mining_start(env: &Env, system_id: u32, acquired_at: u64) -> u64 {
    let last_mined: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::LastMined(system_id))
        .unwrap_or(0);
    last_mined.max(acquired_at)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events};
    use soroban_sdk::{Env, IntoVal};

    struct Fixture<'a> {
        client: ResourcesContractClient<'a>,
        admin: Address,
    }

    fn setup_resources(env: &Env) -> Fixture<'_> {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let iron = env.register_stellar_asset_contract_v2(admin.clone());
        let energy = env.register_stellar_asset_contract_v2(admin.clone());
        let plasma = env.register_stellar_asset_contract_v2(admin.clone());

        let contract_id = env.register(ResourcesContract, ());
        let client = ResourcesContractClient::new(env, &contract_id);
        client.initialize(&admin, &iron.address(), &energy.address(), &plasma.address());

        Fixture { client, admin }
    }

    #[test]
    fn balance_is_zero_for_new_player() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 0);
    }

    #[test]
    fn mint_increases_balance_of_that_resource() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &100);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 100);
    }

    #[test]
    fn mint_does_not_change_other_resource_balances() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &100);

        assert_eq!(fx.client.balance(&player, &ResourceType::Energy), 0);
        assert_eq!(fx.client.balance(&player, &ResourceType::Plasma), 0);
    }

    #[test]
    fn each_resource_is_backed_by_its_own_token() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &1);
        fx.client.mint(&player, &ResourceType::Energy, &20);
        fx.client.mint(&player, &ResourceType::Plasma, &300);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 1);
        assert_eq!(fx.client.balance(&player, &ResourceType::Energy), 20);
        assert_eq!(fx.client.balance(&player, &ResourceType::Plasma), 300);
    }

    #[test]
    fn mint_accumulates_across_calls() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Plasma, &40);
        fx.client.mint(&player, &ResourceType::Plasma, &2);

        assert_eq!(fx.client.balance(&player, &ResourceType::Plasma), 42);
    }

    #[test]
    fn mint_requires_admin_authorization() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &1);

        let (authorizer, _) = env.auths().into_iter().next().unwrap();
        assert_eq!(authorizer, fx.admin);
    }

    #[test]
    fn mint_emits_minted_event() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Energy, &7);

        let (contract, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == fx.client.address)
            .last()
            .unwrap();
        assert_eq!(contract, fx.client.address);
        assert_eq!(topics, (symbol_short!("minted"), player).into_val(&env));
        let payload: (ResourceType, i128) = data.into_val(&env);
        assert_eq!(payload, (ResourceType::Energy, 7));
    }

    #[test]
    fn burn_decreases_balance() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &100);

        fx.client.burn(&player, &ResourceType::Iron, &30);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 70);
    }

    #[test]
    #[should_panic]
    fn burn_panics_when_balance_is_insufficient() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &10);

        fx.client.burn(&player, &ResourceType::Iron, &11);
    }

    #[test]
    fn burn_emits_burned_event() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &10);

        fx.client.burn(&player, &ResourceType::Iron, &4);

        let (contract, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == fx.client.address)
            .last()
            .unwrap();
        assert_eq!(contract, fx.client.address);
        assert_eq!(topics, (symbol_short!("burned"), player).into_val(&env));
        let payload: (ResourceType, i128) = data.into_val(&env);
        assert_eq!(payload, (ResourceType::Iron, 4));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_panics_when_called_twice() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let token = Address::generate(&env);

        fx.client.initialize(&fx.admin, &token, &token, &token);
    }

    #[test]
    #[should_panic(expected = "not initialized")]
    fn mint_panics_before_initialization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ResourcesContract, ());
        let client = ResourcesContractClient::new(&env, &contract_id);
        let player = Address::generate(&env);

        client.mint(&player, &ResourceType::Iron, &1);
    }

    // ── mining ────────────────────────────────────────────────────────────────

    use soroban_sdk::testutils::{Ledger as _, MockAuth, MockAuthInvoke};
    use soroban_sdk::{contract, contractimpl};

    /// Stand-in for galaxy-map: one configurable system.
    #[contract]
    struct MockGalaxy;

    #[contractimpl]
    impl MockGalaxy {
        pub fn seed_system(env: Env, owner: Address, resource_type: ResourceType, resource_yield: u32, last_claimed: u64) {
            let system = StarSystem {
                owner: Some(owner),
                coord_x: 0,
                coord_y: 0,
                resource_type,
                resource_yield,
                defense_rating: 5,
                last_claimed,
                upgrade_level: 0,
            };
            env.storage().instance().set(&symbol_short!("system"), &system);
        }

        pub fn get_system(env: Env, _system_id: u32) -> StarSystem {
            env.storage().instance().get(&symbol_short!("system")).unwrap()
        }
    }

    struct MiningFixture<'a> {
        client: ResourcesContractClient<'a>,
        galaxy: MockGalaxyClient<'a>,
        admin: Address,
    }

    /// The production setup mining requires: the resources contract, not the
    /// deployer, administers the three asset contracts, so it can mint on a
    /// player's behalf without anyone else signing.
    fn setup_mining(env: &Env) -> MiningFixture<'_> {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let contract_id = env.register(ResourcesContract, ());
        let iron = env.register_stellar_asset_contract_v2(contract_id.clone());
        let energy = env.register_stellar_asset_contract_v2(contract_id.clone());
        let plasma = env.register_stellar_asset_contract_v2(contract_id.clone());
        let client = ResourcesContractClient::new(env, &contract_id);
        client.initialize(&admin, &iron.address(), &energy.address(), &plasma.address());

        let galaxy_id = env.register(MockGalaxy, ());
        client.set_galaxy_map(&admin, &galaxy_id);

        MiningFixture { client, galaxy: MockGalaxyClient::new(env, &galaxy_id), admin }
    }

    const YIELD: u32 = 25;

    fn owned_system(env: &Env, fx: &MiningFixture<'_>, resource: ResourceType, acquired_at: u64) -> Address {
        let player = Address::generate(env);
        fx.galaxy.seed_system(&player, &resource, &YIELD, &acquired_at);
        player
    }

    #[test]
    fn mine_pays_one_periods_yield_after_one_period() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        let amount = fx.client.mine(&player, &3);

        assert_eq!(amount, YIELD as i128);
        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), YIELD as i128);
    }

    #[test]
    fn mine_pays_every_full_period_elapsed() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + 3 * MINING_PERIOD_SECONDS + 100);

        assert_eq!(fx.client.mine(&player, &3), 3 * YIELD as i128);
    }

    #[test]
    fn mine_carries_over_a_partial_period_instead_of_losing_it() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + 3 * MINING_PERIOD_SECONDS + 100);
        fx.client.mine(&player, &3);

        // 100s were left over; one more full period completes at 4 periods in.
        env.ledger().set_timestamp(1_000 + 4 * MINING_PERIOD_SECONDS);
        assert_eq!(fx.client.mine(&player, &3), YIELD as i128);
    }

    #[test]
    #[should_panic(expected = "nothing to mine yet")]
    fn mine_cannot_claim_the_same_period_twice() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);
        fx.client.mine(&player, &3);

        fx.client.mine(&player, &3);
    }

    #[test]
    #[should_panic(expected = "nothing to mine yet")]
    fn mine_pays_nothing_before_a_full_period() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS - 1);

        fx.client.mine(&player, &3);
    }

    #[test]
    #[should_panic(expected = "player does not own this system")]
    fn mine_panics_for_a_system_the_player_does_not_own() {
        let env = Env::default();
        let fx = setup_mining(&env);
        owned_system(&env, &fx, ResourceType::Iron, 1_000);
        let stranger = Address::generate(&env);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        fx.client.mine(&stranger, &3);
    }

    #[test]
    fn mine_pays_in_the_systems_own_resource() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Energy, 1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        fx.client.mine(&player, &3);

        assert_eq!(fx.client.balance(&player, &ResourceType::Energy), YIELD as i128);
        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 0);
    }

    #[test]
    fn a_new_owner_mines_only_from_when_they_acquired_the_system() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let first = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + 2 * MINING_PERIOD_SECONDS);
        fx.client.mine(&first, &3);

        // Conquered much later: galaxy-map resets last_claimed to the conquest time.
        let conquered_at = 1_000 + 20 * MINING_PERIOD_SECONDS;
        let second = Address::generate(&env);
        fx.galaxy.seed_system(&second, &ResourceType::Iron, &YIELD, &conquered_at);
        env.ledger().set_timestamp(conquered_at + MINING_PERIOD_SECONDS);

        assert_eq!(fx.client.mine(&second, &3), YIELD as i128);
    }

    #[test]
    fn mine_needs_only_the_players_signature() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Iron, 1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        env.mock_auths(&[MockAuth {
            address: &player,
            invoke: &MockAuthInvoke {
                contract: &fx.client.address,
                fn_name: "mine",
                args: (player.clone(), 3u32).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        assert_eq!(fx.client.mine(&player, &3), YIELD as i128);
    }

    #[test]
    #[should_panic(expected = "Error(Auth, InvalidAction)")]
    fn mining_fails_if_the_deployer_still_administers_the_asset_contracts() {
        // Documents the deployment requirement: with the original setup, where
        // the deployer account is each asset's admin, a player alone can't mine.
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let iron = env.register_stellar_asset_contract_v2(admin.clone());
        let energy = env.register_stellar_asset_contract_v2(admin.clone());
        let plasma = env.register_stellar_asset_contract_v2(admin.clone());
        let contract_id = env.register(ResourcesContract, ());
        let client = ResourcesContractClient::new(&env, &contract_id);
        client.initialize(&admin, &iron.address(), &energy.address(), &plasma.address());
        let galaxy_id = env.register(MockGalaxy, ());
        client.set_galaxy_map(&admin, &galaxy_id);
        let player = Address::generate(&env);
        MockGalaxyClient::new(&env, &galaxy_id).seed_system(&player, &ResourceType::Iron, &YIELD, &1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        env.mock_auths(&[MockAuth {
            address: &player,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "mine",
                args: (player.clone(), 3u32).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.mine(&player, &3);
    }

    #[test]
    fn mine_emits_mined_event() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = owned_system(&env, &fx, ResourceType::Plasma, 1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        fx.client.mine(&player, &3);

        let (_, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == fx.client.address)
            .last()
            .unwrap();
        assert_eq!(topics, (symbol_short!("mined"), player).into_val(&env));
        let payload: (u32, ResourceType, i128) = data.into_val(&env);
        assert_eq!(payload, (3, ResourceType::Plasma, YIELD as i128));
    }

    #[test]
    #[should_panic(expected = "caller is not the admin")]
    fn set_galaxy_map_panics_for_non_admin_caller() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let stranger = Address::generate(&env);

        fx.client.set_galaxy_map(&stranger, &stranger);
    }

    #[test]
    #[should_panic(expected = "galaxy map not set")]
    fn mine_panics_before_a_galaxy_map_is_registered() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mine(&player, &3);
    }

    #[test]
    fn set_galaxy_map_requires_admin_authorization() {
        let env = Env::default();
        let fx = setup_mining(&env);
        fx.client.set_galaxy_map(&fx.admin, &fx.galaxy.address);

        let (authorizer, _) = env.auths().into_iter().last().unwrap();
        assert_eq!(authorizer, fx.admin);
    }

    // ── resource_yield = 0 (#71) ──────────────────────────────────────────────

    /// Issue #71: when a system has resource_yield = 0, mine() should mint 0
    /// tokens (periods * 0 = 0) but still advance last_mined so the clock
    /// moves forward. Calling mine again immediately after should panic with
    /// "nothing to mine yet", confirming last_mined was updated.
    #[test]
    fn mine_mints_zero_and_advances_last_mined_when_yield_is_zero() {
        let env = Env::default();
        let fx = setup_mining(&env);
        env.mock_all_auths();

        let player = Address::generate(&env);
        // Seed a system with resource_yield = 0 — not reachable via normal
        // initialize (which always assigns 10–50), but plausible after a future
        // contract upgrade or a direct storage write during an attack scenario.
        fx.galaxy.seed_system(&player, &ResourceType::Iron, &0u32, &1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);

        let amount = fx.client.mine(&player, &3);

        // amount = periods * resource_yield = 1 * 0 = 0
        assert_eq!(amount, 0);
        // Balance stays at zero — nothing was minted.
        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 0);
    }

    #[test]
    #[should_panic(expected = "nothing to mine yet")]
    fn mine_advances_last_mined_even_when_yield_is_zero() {
        // Confirm that last_mined was advanced: a second mine immediately after
        // the first must see periods = 0 and panic, not pay out again.
        let env = Env::default();
        let fx = setup_mining(&env);
        env.mock_all_auths();

        let player = Address::generate(&env);
        fx.galaxy.seed_system(&player, &ResourceType::Iron, &0u32, &1_000);
        env.ledger().set_timestamp(1_000 + MINING_PERIOD_SECONDS);
        fx.client.mine(&player, &3); // first mine — mints 0 but advances clock

        // Timestamp has not advanced past another full period, so this must panic.
        fx.client.mine(&player, &3);
    }

    // ── pause / unpause ───────────────────────────────────────────────────────

    #[test]
    fn contract_is_not_paused_after_initialization() {
        let env = Env::default();
        let fx = setup_resources(&env);

        assert!(!fx.client.is_paused());
    }

    #[test]
    fn admin_can_pause_the_contract() {
        let env = Env::default();
        let fx = setup_resources(&env);

        fx.client.pause(&fx.admin);

        assert!(fx.client.is_paused());
    }

    #[test]
    fn admin_can_unpause_a_paused_contract() {
        let env = Env::default();
        let fx = setup_resources(&env);
        fx.client.pause(&fx.admin);

        fx.client.unpause(&fx.admin);

        assert!(!fx.client.is_paused());
    }

    #[test]
    #[should_panic(expected = "already paused")]
    fn pause_panics_when_already_paused() {
        let env = Env::default();
        let fx = setup_resources(&env);
        fx.client.pause(&fx.admin);

        fx.client.pause(&fx.admin);
    }

    #[test]
    #[should_panic(expected = "not paused")]
    fn unpause_panics_when_not_paused() {
        let env = Env::default();
        let fx = setup_resources(&env);

        fx.client.unpause(&fx.admin);
    }

    #[test]
    #[should_panic(expected = "caller is not the admin")]
    fn pause_panics_for_non_admin_caller() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let stranger = Address::generate(&env);

        fx.client.pause(&stranger);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn mint_panics_when_contract_is_paused() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.pause(&fx.admin);

        fx.client.mint(&player, &ResourceType::Iron, &10);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn burn_panics_when_contract_is_paused() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &10);
        fx.client.pause(&fx.admin);

        fx.client.burn(&player, &ResourceType::Iron, &5);
    }

    // ── admin mint after SAC admin handoff (#137) ─────────────────────────────

    /// Issue #137: #16 handed SAC admin for IRON/NRGY/PLSM to this contract so
    /// players can mine. The contract's own admin-only `mint` relies on the
    /// same property — this contract must be able to act as the SAC admin for
    /// its internal `SAC.mint` sub-invocation. This test performs that handoff
    /// (as `setup_mining` does for the `mine` tests) and then confirms `mint`
    /// still succeeds.
    ///
    /// Only the app-level admin authorization is mocked: the SAC-side
    /// authorization must succeed on its own because this contract is the
    /// asset admin. If a future change breaks either half of the interaction,
    /// this test fails with an auth error (or a zero balance) without needing
    /// a live testnet check.
    #[test]
    fn admin_mint_still_works_after_sac_admin_handoff() {
        let env = Env::default();
        let fx = setup_mining(&env);
        let player = Address::generate(&env);

        // mock_auths replaces the mock_all_auths from setup: only the stored
        // app admin's signature is provided for the top-level `mint` call.
        env.mock_auths(&[MockAuth {
            address: &fx.admin,
            invoke: &MockAuthInvoke {
                contract: &fx.client.address,
                fn_name: "mint",
                args: (player.clone(), ResourceType::Iron, 100i128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        fx.client.mint(&player, &ResourceType::Iron, &100);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 100);
    }
}
