# Freighter Wallet Setup Troubleshooting

Connecting your Freighter wallet to Starbound Realms is required to claim systems, mine resources, build fleets, and battle other players. If you're having trouble, start here.

---

## Common Issues

### "Connect Wallet" button does nothing

**Cause:** Freighter extension is not installed.

**Fix:**
1. Go to [Freighter's official extension page](https://www.freighter.app/)
2. Click the **Install** button for your browser (Chrome, Firefox, Edge, or Brave)
3. Reload the Starbound Realms page
4. Try connecting again

### "Freighter is not installed or not available"

**Cause:** Same as above — the extension isn't running or your browser doesn't support it.

**Fix:**
- Ensure Freighter is installed (see above)
- Check that the extension is enabled in your browser's extension manager
- If using a private/incognito window, extensions may be blocked by default. Try a regular window instead
- Try a different browser if available

### "Freighter access request was declined"

**Cause:** You clicked "Reject" or "Deny" in the Freighter popup, or the connection timed out.

**Fix:**
1. Click **Connect Wallet** again
2. When the Freighter popup appears, click **Approve** (or **Allow**)
3. If you don't see a popup, check that it hasn't opened behind the browser window, or try closing all extension popups and trying again
4. If the popup is unresponsive, reload the page and try once more

### Connected, but can't see my account/balance/systems

**Cause:** You're connected to the wrong Stellar network.

**Fix:**
1. Open Freighter (click the extension icon in your browser's top-right)
2. At the top, check the network dropdown — it should say **Testnet**
3. If it says **Public Network** or another network, click it and select **Testnet**
4. Reload the Starbound Realms page
5. Your account should now appear

### "Your wallet can't hold IRON/NRGY/PLSM yet" (yellow banner)

**Cause:** Your Freighter wallet hasn't established a trustline to these in-game resources. This is a Stellar requirement for receiving custom assets.

**Fix:**
1. The yellow banner should appear automatically with a **Set up resources** button
2. Click the button and approve the transaction in Freighter
3. This creates trustlines for all three resources (Iron, Energy, Plasma) in a single transaction
4. After approval, you'll be able to mine, receive trades, and build fleets
5. This only needs to happen once per wallet

### "Network mismatch" or "wrong network" error

**Cause:** The app is trying to use a different Stellar network (or RPC endpoint) than what your Freighter is on.

**Fix:**
1. Ensure Freighter is set to **Testnet** (not Public Network)
2. Reload the Starbound Realms page completely (Cmd+Shift+R or Ctrl+Shift+R)
3. If the error persists, check the app's `.env` file to confirm it matches your Freighter network

### Still can't connect after trying all of this?

**Next steps:**
1. Open the browser's developer console (F12 or Cmd+Option+I) and look for any error messages
2. Check the [Freighter documentation](https://docs.freighter.app/)
3. File an issue on the [Starbound Realms GitHub](https://github.com/OlaGreat/starbound-realms/issues) with:
   - Your browser and OS
   - Which step fails (Freighter installed? Network correct? Transaction approved?)
   - Any error messages from the console

---

## Network Quick Reference

| Setting | Testnet | Public Network (Mainnet) |
|---|---|---|
| **Freighter network** | Testnet | Public Network |
| **Network passphrase** | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| **RPC endpoint** | `https://soroban-testnet.stellar.org` | `https://soroban-mainnet.stellar.org` |
| **Testing** | Use this — it's free and fast | Do not use for testing; real funds required |

---

## Trustlines Explained

A trustline is a Stellar protocol feature that lets you opt-in to receiving a custom asset (like IRON, NRGY, or PLSM). Without a trustline, your account cannot receive that asset — the transaction fails silently.

**Why?** It's a security feature: an account holder has explicit control over which custom assets they're willing to hold. Starbound Realms automates this for you with the **Set up resources** button, but under the hood, it's creating three trustlines (one per resource) in a single transaction.

**Can I remove a trustline?** Yes, but you'll stop receiving that resource and it's rarely necessary. Leave them set up.

---

## Still need help?

- **Discord community:** Join the Stellar community at [stellar.org/community](https://stellar.org/community)
- **Report a bug:** [GitHub Issues](https://github.com/OlaGreat/starbound-realms/issues)
- **Freighter docs:** [freighter.app](https://www.freighter.app/)
