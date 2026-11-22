# Testnet vs Mainnet: What's Different?

Starbound Realms runs on the Stellar blockchain. During development and testing, it runs on **Testnet**. Eventually, it will launch on **Mainnet** (also called Public Network).

This guide explains what differs between them so you can develop confidently.

---

## Quick Reference

| Aspect | Testnet | Mainnet |
|---|---|---|
| **Purpose** | Testing, development, education | Live, real assets, real value |
| **Network name in Freighter** | Testnet | Public Network |
| **Network passphrase** | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| **RPC URL** | `https://soroban-testnet.stellar.org` | `https://soroban-mainnet.stellar.org` |
| **Contract addresses** | Deployed independently | Will differ from testnet |
| **Fees** | Fractions of a cent (testnet lumens) | Real XLM costs (but still cheap) |
| **Resets** | May reset without warning | Never resets (permanent) |
| **Assets** | Testnet-only versions of IRON/NRGY/PLSM | Real assets; can be traded freely |

---

## Configuration

### For Development (use Testnet)

**Frontend:** Copy `.env.testnet` into `frontend/.env`

```bash
cp .env.testnet frontend/.env
```

This sets your app to use:
- Testnet RPC endpoint
- Testnet contract addresses
- Testnet resource token contracts
- Testnet network passphrase

**Freighter configuration:**
1. Open Freighter
2. Click the network dropdown at the top
3. Select **Testnet**
4. Create or import an account
5. Reload the app

**Get testnet XLM:** Use the [Stellar testnet faucet](https://developers.stellar.org/docs/learn/fundamentals/testnet-public-net) to fund your account with free testnet lumens.

### For Mainnet (future)

Mainnet contracts don't yet exist — this is a placeholder for when they're deployed.

**Frontend:** A `.env.mainnet` file will specify mainnet contracts and RPC endpoints.

**Freighter configuration:**
1. Open Freighter
2. Click the network dropdown
3. Select **Public Network**
4. Connect with an account that holds real XLM
5. Reload the app

---

## Fees and Costs

### Testnet
- **Transactions:** A few stroops (10,000 stroops = 1 XLM)
- **Cost in real money:** Free (testnet XLM has no value)
- **Network capacity:** Shared; may be slower during heavy testing

### Mainnet
- **Transactions:** Typically 100–1,000 stroops per transaction
- **Cost in real money:** Roughly $0.00001–0.0001 USD per transaction (highly dependent on XLM price)
- **Network capacity:** Faster during normal periods; can get expensive if many transactions compete
- **Recommendation:** Even on mainnet, Stellar's fees are negligible compared to other blockchains

---

## Data Persistence

### Testnet
- **Data survives:** Until the testnet resets (can happen without warning during the beta)
- **Historical data:** May be pruned
- **Reset policy:** Resets announced on [Stellar developers Discord](https://discord.gg/stellardev)

### Mainnet
- **Data is permanent:** Once a transaction is finalized, it stays on-chain forever
- **Historical queries:** Available going back to genesis
- **Implications:** Any choice you make (fleet built, system claimed) is permanent; no "undo"

---

## Testnet Resets: What Happens?

1. All accounts and balances are cleared
2. All contracts must be redeployed
3. All game state (systems, fleets, claims) is lost
4. `.env.testnet` is updated with new contract addresses
5. Players start fresh

**During Starbound Realms beta:** Testnet resets may happen. Any progress will be lost. This is expected.

**On Mainnet:** Never resets.

---

## Network Passphrase Explained

The **network passphrase** is a unique identifier for each Stellar network. It's baked into every transaction and prevents replay attacks (a transaction meant for testnet can't be executed on mainnet).

- **Testnet:** `Test SDF Network ; September 2015`
- **Mainnet:** `Public Global Stellar Network ; September 2015`

If your Freighter network doesn't match the app's configured passphrase, the transaction will fail silently. This is Stellar's security layer.

**You don't need to set this manually** — Freighter and the SDK handle it automatically when you select the network.

---

## Contract Addresses: Why They Differ

Contracts are deployed independently to each network:

| Contract | Testnet Address | Mainnet Address |
|---|---|---|
| `galaxy-map` | `CBT7KW...` | TBD (not yet deployed) |
| `resources` | `CCXFT...` | TBD (not yet deployed) |
| `fleet` | `CDN4H...` | TBD (not yet deployed) |
| `battle` | `CDOFU...` | TBD (not yet deployed) |

Each deployment is independent because:
1. They're deployed to different networks (different data, different history)
2. Different admins may manage mainnet contracts
3. Contract upgrades on testnet don't affect mainnet

**When mainnet launches:** New contract addresses will be deployed, and `.env.mainnet` will be created.

---

## Development Workflow

1. **Develop locally or on testnet** (use `.env.testnet`)
2. **Test with testnet XLM** (free from faucet)
3. **Verify contracts on [Stellar Expert](https://stellar.expert/)**
4. **When ready to launch:** Deploy to mainnet, create `.env.mainnet`, update app to point there
5. **Testnet remains available** for further testing and onboarding new developers

---

## Checklist: Am I on the Right Network?

- [ ] Freighter shows **Testnet** (or **Public Network** for mainnet)
- [ ] App loads and shows contract addresses
- [ ] Wallet connects without errors
- [ ] `.env` file matches your network choice
- [ ] If testing payment flow: use testnet XLM (free), not real XLM

---

## Troubleshooting Network Issues

| Problem | Solution |
|---|---|
| "Network mismatch" error | Check Freighter is on the same network as the app. Reload. |
| Wallet connects but shows $0 balance | Testnet? Use the faucet to fund your account. Mainnet? Fund with real XLM. |
| Transactions fail silently | Check network passphrase. Reload the app. Try again. |
| App shows wrong contract addresses | Ensure `.env` file has the right network config. Restart dev server. |

---

## Learn More

- **Stellar networks:** [stellar.org/developers/network](https://developers.stellar.org/docs/learn/fundamentals/testnet-public-net)
- **Testnet faucet:** [developers.stellar.org/faucet](https://developers.stellar.org/docs/learn/fundamentals/testnet-public-net)
- **Contract deployment:** [soroban.stellar.org/docs](https://soroban.stellar.org/docs)
- **Fee estimates:** [stellar.expert](https://stellar.expert/)
