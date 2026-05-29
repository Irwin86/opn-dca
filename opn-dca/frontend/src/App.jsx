import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { useState } from "react";
import { opnTestnet } from "./config";
import CreatePosition from "./components/CreatePosition";
import PositionList from "./components/PositionList";
import styles from "./App.module.css";

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [tab, setTab] = useState("positions");

  const wrongNetwork = isConnected && chainId !== opnTestnet.id;

  return (
    <div className={styles.root}>
      {/* Background grid */}
      <div className={styles.grid} aria-hidden />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          <span>OPN<span className={styles.logoAccent}>-DCA</span></span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.network}>
            <span className={styles.networkDot} />
            OPN Chain Testnet
          </span>
          {isConnected ? (
            <button className={styles.btnOutline} onClick={() => disconnect()}>
              {address.slice(0, 6)}…{address.slice(-4)}
            </button>
          ) : (
            <button
              className={styles.btnPrimary}
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <p className={styles.heroTag}>Season 1 · DeFi &amp; Open Finance</p>
        <h1 className={styles.heroTitle}>
          Automated DCA,<br />
          <span className={styles.heroAccent}>fully on-chain.</span>
        </h1>
        <p className={styles.heroSub}>
          Set a recurring token swap. The chain does the rest — permissionless,
          non-custodial, zero off-chain dependencies.
        </p>
        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statVal}>0%</span>
            <span className={styles.statLabel}>Custody risk</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statVal}>0.3%</span>
            <span className={styles.statLabel}>Protocol fee</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statVal}>Any</span>
            <span className={styles.statLabel}>ERC-20 pair</span>
          </div>
        </div>
      </section>

      {/* Wrong network banner */}
      {wrongNetwork && (
        <div className={styles.banner}>
          ⚠ Wrong network detected.{" "}
          <button
            className={styles.bannerBtn}
            onClick={() => switchChain({ chainId: opnTestnet.id })}
          >
            Switch to OPN Chain Testnet
          </button>
        </div>
      )}

      {/* Main content */}
      {isConnected && !wrongNetwork ? (
        <main className={styles.main}>
          <div className={styles.tabs}>
            <button
              className={tab === "positions" ? styles.tabActive : styles.tab}
              onClick={() => setTab("positions")}
            >
              My Positions
            </button>
            <button
              className={tab === "create" ? styles.tabActive : styles.tab}
              onClick={() => setTab("create")}
            >
              + New Position
            </button>
          </div>

          {tab === "positions" ? (
            <PositionList address={address} onCreateNew={() => setTab("create")} />
          ) : (
            <CreatePosition onSuccess={() => setTab("positions")} />
          )}
        </main>
      ) : !isConnected ? (
        <div className={styles.connectPrompt}>
          <p>Connect your wallet to start automating your DCA strategy on OPN Chain.</p>
          <button
            className={styles.btnPrimary}
            onClick={() => connect({ connector: connectors[0] })}
          >
            Connect Wallet
          </button>
        </div>
      ) : null}

      <footer className={styles.footer}>
        Built by{" "}
        <a href="https://github.com/Irwin86/opn-dca" target="_blank" rel="noreferrer">
          Irwin86
        </a>{" "}
        · IOPn Builders Programme Season 1
      </footer>
    </div>
  );
}
