import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useWalletClient, usePublicClient } from "wagmi";


// Wagmi hooks (custom connect buttons)
import { useConnect, useAccount, useDisconnect } from "wagmi";

import {
  BOOK_ADDRESS,
  TOKEN_ADDRESS,
  BOOK_ABI,
  TOKEN_ABI,
  CHAIN_ID_HEX,
} from "./config";
import "./App.css";



/* ------------------ LocalStorage Keys ------------------ */
const LS_BOOK_META = "bookstore.bookMeta";
const LS_YT_LINK = "bookstore.ytLink";

/* Utility */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Parse many YouTube URL shapes into a clean embed URL */
function toYouTubeEmbed(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || "";
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
    } else if (u.hostname === "youtu.be") {
      id = u.pathname.slice(1);
    }
    id = (id || "").trim();
    if (!id) return "";
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  } catch {
    return "";
  }
}



export default function App() {

  /* ---------------- Wagmi wallet states ---------------- */
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // For open connect options******
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  // For open connect options******

  /* ------------------ UI State ------------------ */
  const [view, setView] = useState("home");
  const [ownerAddr, setOwnerAddr] = useState(null);

  const [jgBalance, setJgBalance] = useState(0n);
  const [ownedBooks, setOwnedBooks] = useState([]);

  const [bookMeta, setBookMeta] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_BOOK_META) || "{}");
    } catch {
      return {};
    }
  });

  const [priceMap, setPriceMap] = useState({});
  const [activeBuyId, setActiveBuyId] = useState(null);

  /* Admin Inputs */
  const [adminBookId, setAdminBookId] = useState("");
  const [adminBookName, setAdminBookName] = useState("");
  const [adminEthHuman, setAdminEthHuman] = useState("");
  const [adminJgHuman, setAdminJgHuman] = useState("");
  const [approveAmountHuman, setApproveAmountHuman] = useState("1000");
  const [newTokenAddress, setNewTokenAddress] = useState("");

  const [ytLink, setYtLink] = useState(() => {
    try {
      return localStorage.getItem(LS_YT_LINK) || "";
    } catch {
      return "";
    }
  });
  const [showVideo, setShowVideo] = useState(true);

  /* Reader Modal */
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerBook, setReaderBook] = useState(null);

  /* Toast */
  const [toast, setToast] = useState("");

  /* every-button processing flags */
  const [claimLoading, setClaimLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [withdrawEthLoading, setWithdrawEthLoading] = useState(false);
  const [withdrawTokenLoading, setWithdrawTokenLoading] = useState(false);
  const [setPriceLoading, setSetPriceLoading] = useState(false);
  const [setTokenAddrLoading, setSetTokenAddrLoading] = useState(false);
  const [buyEthLoadingId, setBuyEthLoadingId] = useState(null);
  const [buyJgLoadingId, setBuyJgLoadingId] = useState(null);


  // Toast notifier (used across the app)
  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };



  /* ------------------ Ethereum Provider (Wagmi v2 TRUE FIX) ------------------ */
  const { data: walletClient } = useWalletClient();   // signer (WalletConnect + MetaMask)
  const publicClient = usePublicClient();             // read RPC

  // Create provider priority: walletClient → RPC
  const provider = useMemo(() => {
    // 1) WalletConnect / MetaMask signer available
    if (walletClient) {
      return new ethers.BrowserProvider(walletClient);
    }

    // 2) Read-only provider
    if (publicClient) {
      return new ethers.JsonRpcProvider(publicClient.transport?.url);
    }

    return null;
  }, [walletClient, publicClient]);

  // Signer (WalletConnect OR MetaMask extension)
  const getSigner = async () => {
    if (!walletClient) {
      throw new Error("Wallet not connected");
    }
    const browserProvider = new ethers.BrowserProvider(walletClient);
    return await browserProvider.getSigner();
  };


  // Refresh data after transaction
  const refreshAll = async () => {
    try {
      await loadBalance();
      await refreshOwnedForIds(allBookIds);
      await loadPrices(allBookIds);
      await loadOwner();
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };



  // Read contracts
  const bookRead = () => new ethers.Contract(BOOK_ADDRESS, BOOK_ABI, provider);
  const tokenRead = () => new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

  // Write contracts
  const bookWrite = async () => {
    const s = await getSigner();
    return new ethers.Contract(BOOK_ADDRESS, BOOK_ABI, s);
  };

  const tokenWrite = async () => {
    const s = await getSigner();
    return new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, s);
  };




  /* ---------------------Pinata image upload ----------------------*/

  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;



  const uploadToPinata = async (file) => {
    const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    const data = await res.json();
    console.log("PINATA RAW:", data);

    if (!res.ok || !data.IpfsHash) {
      throw new Error("Pinata Upload Failed");
    }

    // Best gateway
    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
  };




  /* ------------------ Helpers: Base Book IDs ------------------ */
  const baseIds = [1, 2, 3];

  const allBookIds = useMemo(() => {
    const metaIds = Object.keys(bookMeta).map(Number);
    const merged = Array.from(new Set([...baseIds, ...metaIds]));
    return merged.sort((a, b) => a - b);
  }, [bookMeta]);

  /* ------------------ Load Owner ------------------ */
  const loadOwner = async () => {
    try {
      if (!provider) return;
      const c = bookRead();
      const o = await c.owner();
      setOwnerAddr(o.toLowerCase());
    } catch { }
  };

  /* ------------------ Load Balance ------------------ */
  const loadBalance = async () => {
    if (!address) return;
    const t = tokenRead();
    const bal = await t.balanceOf(address);
    setJgBalance(bal);
  };

  /* ------------------ Load Ownership ------------------ */
  const refreshOwnedForIds = async (ids) => {
    if (!address) return;
    const c = bookRead();
    const owned = [];
    for (const id of ids) {
      try {
        const has = await c.hasPurchased(address, id);
        if (has) owned.push(id);
      } catch { }
    }
    setOwnedBooks(owned);
  };

  /* ------------------ Load Prices ------------------ */
  const loadPrices = async (ids) => {
    if (!provider) return;
    const c = bookRead();
    const updated = {};
    for (const id of ids) {
      try {
        updated[id] = {
          eth: await c.ethPrice(id),
          jg: await c.tokenPrice(id),
        };
      } catch { }
    }
    setPriceMap((prev) => ({ ...prev, ...updated }));
  };

  /* ------------------ Claim JG ------------------ */
  const claimJG = async () => {
    try {
      setClaimLoading(true);
      const t = await tokenWrite();
      const tx = await t.claim();
      showAirdropBurst();
      await tx.wait();
      await loadBalance();
      await refreshAll();
      notify("Claimed JG! ✅");
    } catch (e) {
      console.error(e);
    } finally {
      setClaimLoading(false);
    }
  };

  const showAirdropBurst = async () => {
    const root = document.querySelector(".airdrop-layer");
    if (!root) return;
    root.innerHTML = "";
    for (let i = 0; i < 18; i++) {
      const span = document.createElement("span");
      span.className = "drop";
      span.style.left = Math.random() * 100 + "%";
      span.style.animationDelay = Math.random() * 0.3 + "s";
      root.appendChild(span);
    }
    root.classList.add("show");
    await sleep(1200);
    root.classList.remove("show");
    root.innerHTML = "";
  };

  const preBuyDiagnostics = async (id) => {
    try {
      const user = address;
      const c = bookRead();
      const t = tokenRead();

      const [price, allowance, balance, alreadyPurchased] = await Promise.all([
        c.tokenPrice(Number(id)),
        t.allowance(user, BOOK_ADDRESS),
        t.balanceOf(user),
        c.hasPurchased(user, Number(id)),
      ]);

      return {
        price,
        allowance,
        balance,
        alreadyPurchased,
      };
    } catch (err) {
      console.error("preBuyDiagnostics failed:", err);
      throw err;
    }
  };


  const buyWithEth = async (id) => {
    try {
      setBuyEthLoadingId(id);
      const c = await bookWrite();
      const p = priceMap[id]?.eth ?? 0n;
      const tx = await c.buyWithEth(id, { value: p });
      await tx.wait();
      await refreshOwnedForIds([id]);
      setActiveBuyId(null);
      await refreshAll();
      notify("Bought with ETH ✅");
    } catch (e) {
      console.error(e);
    } finally {
      setBuyEthLoadingId((x) => (x === id ? null : x));
    }
  };


  const buyWithJG = async (id) => {
    try {
      setBuyJgLoadingId(id);

      if (!walletClient) throw new Error("Wallet not connected");

      // 1) diagnostics: price + allowance
      const diag = await preBuyDiagnostics(id);
      console.log("preBuyDiagnostics:", diag);

      if (diag.alreadyPurchased) {
        notify("Already purchased");
        return;
      }


      if (diag.allowance < diag.price) {
        const approveTx = await walletClient.writeContract({
          address: TOKEN_ADDRESS,
          abi: TOKEN_ABI,
          functionName: "approve",
          args: [BOOK_ADDRESS, ethers.MaxUint256],  // infinite approval
        });

        if (publicClient && approveTx) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }


      // 2) now call buyWithToken on book contract using ethers signer (or walletClient)
      // Using ethers (keep existing pattern) - ensure signer works
      const c = await bookWrite();
      const tx = await c.buyWithToken(id);
      await tx.wait();

      await refreshOwnedForIds([id]);
      setActiveBuyId(null);
      await refreshAll();
      notify("Bought with JG ✅");
    } catch (e) {
      console.error("buyWithJG error:", e);
    } finally {
      setBuyJgLoadingId((x) => (x === id ? null : x));
    }
  };


  /* ------------------ Admin: Prices ------------------ */
  const adminSetPrice = async () => {
    if (!adminBookId) return alert("Book ID required");
    try {
      setSetPriceLoading(true);
      const c = await bookWrite();
      const ethWei = ethers.parseEther(adminEthHuman || "0");
      const jgWei = ethers.parseUnits(adminJgHuman || "0", 18);
      await (await c.setBookPrice(Number(adminBookId), ethWei, jgWei)).wait();
      await loadPrices([Number(adminBookId)]);
      await refreshAll();
      notify("Price updated ✅");
    } catch (e) {
      console.error(e);
    } finally {
      setSetPriceLoading(false);
    }
  };

  /* Withdraw */
  const adminWithdrawEth = async () => {
    try {
      setWithdrawEthLoading(true);
      const c = await bookWrite();
      await (await c.withdrawEth()).wait();
      await refreshAll();
      notify("ETH withdrawn ✅");
    } catch (e) {
      console.error(e);
    } finally {
      setWithdrawEthLoading(false);
    }
  };

  const adminWithdrawToken = async () => {
    try {
      setWithdrawTokenLoading(true);
      const c = await bookWrite();
      await (await c.withdrawToken()).wait();
      await refreshAll();
      notify("JG withdrawn ✅");
    } catch (e) {
      console.error(e);
    } finally {
      setWithdrawTokenLoading(false);
    }
  };

  const adminSetTokenAddress = async () => {
    try {
      setSetTokenAddrLoading(true);
      const c = await bookWrite();
      await (await c.setTokenAddress(newTokenAddress)).wait();
      await refreshAll();
      notify("Token address updated ✅");
    } catch (e) {
      console.error(e);
    } finally {
      setSetTokenAddrLoading(false);
    }
  };

  /* ------------------ Book Meta (Name + Image) ------------------ */
  const persistBookMeta = (next) => {
    setBookMeta(next);
    try {
      localStorage.setItem(LS_BOOK_META, JSON.stringify(next));
    } catch { }
  };


  const handleImageUpload = async (e, id) => {
    if (!id) {
      alert("Please enter Book ID first");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ipfsUrl = await uploadToPinata(file);

      const next = {
        ...bookMeta,
        [id]: {
          ...(bookMeta[id] || {}),
          img: ipfsUrl,
          name: bookMeta[id]?.name || `Book #${id}`,
        },
      };

      persistBookMeta(next);
      notify("Image uploaded successfully 🎉");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };



  const addOrUpdateBookMeta = () => {
    if (!adminBookId) return alert("Enter Book ID");
    const id = String(adminBookId);
    const next = {
      ...bookMeta,
      [id]: {
        ...(bookMeta[id] || {}),
        name: adminBookName || bookMeta[id]?.name || `Book #${id}`,
      },
    };
    persistBookMeta(next);
    alert("Book Saved ✅");
  };

  /* ------------------ Reader ------------------ */
  const openReader = (id) => {
    if (!ownedBooks.includes(id)) return;
    setReaderBook(id);
    setReaderOpen(true);
  };

  /* ------------------ Save YouTube Link ------------------ */
  const saveYt = () => {
    try {
      localStorage.setItem(LS_YT_LINK, ytLink);
      setShowVideo(true);
      notify("Video link saved ✅");
    } catch { }
  };

  /* ------------------ Effects ------------------ */
  useEffect(() => {
    if (provider) {
      loadPrices(allBookIds);
      loadOwner();
    }
  }, [provider, allBookIds]);

  useEffect(() => {
    if (address) {
      loadBalance();
      refreshOwnedForIds(allBookIds);
    } else {
      setJgBalance(0n);
      setOwnedBooks([]);
    }
  }, [address, allBookIds]);

  /* ------------------ Format Helpers ------------------ */
  const fmtJG = (v) =>
    Number(ethers.formatEther(v || 0n)).toFixed(2) + " JG";

  const isAdmin =
    address && ownerAddr && address.toLowerCase() === ownerAddr;

  /* ------------------ Render ------------------ */
  return (
    <div className="wrapper">
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* ---------- NAV ---------- */}
      <nav className="topbar">
        <div className="brand">
          <div className="coin">
            <svg viewBox="0 0 40 40">
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stopColor="#7aa7ff" />
                  <stop offset="1" stopColor="#4f6cff" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="18" fill="url(#g)" />
              <text
                x="20"
                y="24"
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="#fff"
              >
                JG
              </text>
            </svg>
          </div>
          <span>BookStore</span>
        </div>

        <div className="nav-links">
          <button
            className={view === "home" ? "pill active" : "pill"}
            onClick={() => setView("home")}
          >
            Home
          </button>


          <button
            className={view === "library" ? "pill active" : "pill"}
            onClick={() => setView("library")}
          >
            Library
          </button>

          <button
            className={view === "admin" ? "pill active" : "pill"}
            onClick={() => setView("admin")}
          >
            Admin
          </button>



          {/* ---------------- CONNECT DROPDOWN ----------------*/}
          <div
            id="wallet-wrapper"
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            {isConnected ? (
              <button
                className="connect"
                onClick={() => disconnect()}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {address?.slice(0, 6)}…{address?.slice(-4)}

                <span className="dot" />
              </button>
            ) : (
              <button
                className="connect"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWalletOptions(!showWalletOptions);
                }}
              >
                Connect
              </button>
            )}

            {/* OPTIONS DROPDOWN */}
            {!isConnected && showWalletOptions && (
              <div
                id="wallet-menu"
                className="wallet-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                {/* MetaMask */}
                <button
                  className="wallet-btn"
                  onClick={() => {
                    setShowWalletOptions(false);
                    const meta = connectors.find((c) => c.id === "metaMask");

                    if (window.ethereum?.isMetaMask) {
                      connect({ connector: meta });
                    } else {
                      const wc = connectors.find((c) => c.id === "walletConnect");
                      connect({ connector: wc });
                    }
                  }}
                >
                  <div className="w-left">
                    MetaMask
                    <span className="popular-badge">Popular</span>
                  </div>
                  <img src="/icons/metamask.png" className="wallet-icon" />
                </button>


                {/* WalletConnect */}
                <button
                  className="wallet-btn"
                  onClick={() => {
                    setShowWalletOptions(false);
                    connect({
                      connector: connectors.find((c) => c.id === "walletConnect"),
                    });
                  }}
                >
                  <div className="w-left">WalletConnect</div>
                  <img src="/icons/walletconnect.png" className="wallet-icon" />
                </button>
              </div>
            )}
          </div>
          {/* ---------------- END CONNECT DROPDOWN ---------------- */}


        </div >
      </nav >

      {/* ---------- STATS (hide in admin) ---------- */}
      {
        view !== "admin" && (
          <section className="stats">
            <div className="stat">
              <div className="stat-label">
                <span className="badge">JG</span>Balance
              </div>
              <div className="stat-value">{fmtJG(jgBalance)}</div>
            </div>

            <div className="stat">
              <div className="stat-label">Owned Books</div>
              <div className="stat-value">{ownedBooks.length}</div>
            </div>

            <div className="stat claim-row">
              <button
                className="cta"
                onClick={claimJG}
                disabled={claimLoading}
              >
                {claimLoading ? "Processing…" : "Claim JG"}
              </button>

              <div className="token-copy">
                <span className="label">Token:</span>

                <span
                  className="copy-address"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "0xD9cFff0E93c198A2e5215E49097E8eF3FaE8443E"
                    );
                    notify("Token address copied! 📋");
                  }}
                >
                  0xD9c. . . . . . .F3FaE8443E

                  <svg
                    className="copy-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </span>
              </div>
            </div>

          </section>
        )
      }

      <div className="airdrop-layer" />

      {
        view === "home" && (
          <>
            <section className="section">
              <h2>Available Books</h2>
              <div className="book-grid">
                {allBookIds.map((id) => {
                  const meta = bookMeta[id] || {};
                  const owned = ownedBooks.includes(id);
                  const p = priceMap[id] || {};
                  const eth =
                    p.eth != null ? ethers.formatEther(p.eth) : "—";
                  const jg =
                    p.jg != null
                      ? ethers.formatUnits(p.jg, 18)
                      : "—";

                  return (
                    <div className="book-card" key={id}>
                      <div
                        className={owned ? "status purchased" : "status"}
                      >
                        {owned ? "Purchased" : "Available"}
                      </div>

                      <div
                        className="book-cover"
                        onClick={() => owned && openReader(id)}
                      >
                        {meta.img ? (
                          <img src={meta.img} alt="" />
                        ) : (
                          <div className="cover-fallback">#{id}</div>
                        )}
                      </div>

                      <div className="book-info">
                        <h3 className="book-title">
                          {meta.name || `Book #${id}`}
                        </h3>

                        <div className="price-label">Price</div>
                        <div className="price-row">
                          <span>ETH:</span>
                          <b>{eth}</b>
                        </div>
                        <div className="price-row">
                          <span>JG:</span>
                          <b>{jg}</b>
                        </div>
                      </div>

                      {!owned ? (
                        <div className="buy-wrap">
                          <button
                            className="btn primary"
                            onClick={() =>
                              setActiveBuyId(
                                activeBuyId === id ? null : id
                              )
                            }
                          >
                            Buy
                          </button>

                          {activeBuyId === id && (
                            <div className="buy-sheet">
                              <button
                                onClick={() => buyWithEth(id)}
                                disabled={buyEthLoadingId === id}
                              >
                                {buyEthLoadingId === id
                                  ? "Processing…"
                                  : "Buy with ETH"}
                              </button>

                              <button
                                onClick={() => buyWithJG(id)}
                                disabled={buyJgLoadingId === id}
                              >
                                {buyJgLoadingId === id
                                  ? "Processing…"
                                  : "Buy with JG"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button className="btn owned" disabled>
                          ✓ Purchased
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* How to */}
            <section className="section howto">
              <h2>How to Use</h2>
              <div className="howto-grid">
                <div className="howto-left">
                  <ol className="howto-steps">
                    <li>Connect with MetaMask or WalletConnect on the Sepolia Testnet.</li>
                    <li>Open a book, click Buy, and choose ETH or JG Tokens.</li>
                    <li>To buy with JG, first Claim Tokens (you get 5 JG per claim).</li>
                    <li>JG purchases need a one-time Approve. The next transaction completes the Buy.</li>
                    <li>After confirmation, your book appears in the Library.</li>
                    <li>A quick tutorial video is available on the right.</li>
                  </ol>


                </div>

                <div className="howto-right">
                  {showVideo && toYouTubeEmbed(ytLink) ? (
                    <div className="yt-frame">
                      <button
                        className="yt-close"
                        onClick={() => setShowVideo(false)}
                      >
                        ×
                      </button>

                      <iframe
                        src={toYouTubeEmbed(ytLink)}
                        title="Tutorial"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="yt-placeholder">
                      Add a YouTube link to preview
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="footer">
              <h3>Privacy & Terms</h3>

              <div className="meta">
                © {new Date().getFullYear()} • Web3 Visionary Jetharam Gehlot
              </div>
            </footer>
          </>
        )
      }

      {/* ---------- LIBRARY ---------- */}
      {
        view === "library" && (
          <section className="section">
            <h2>Your Library</h2>
            <div className="book-grid">
              {ownedBooks.length === 0 && (
                <div className="empty">No purchased books</div>
              )}

              {ownedBooks.map((id) => {
                const meta = bookMeta[id] || {};

                return (
                  <div className="book-card" key={`lib-${id}`}>
                    <div className="status purchased">Purchased</div>

                    <div
                      className="book-cover"
                      onClick={() => openReader(id)}
                    >
                      {meta.img ? (
                        <img src={meta.img} alt="" />
                      ) : (
                        <div className="cover-fallback">#{id}</div>
                      )}
                    </div>

                    <div className="book-info">
                      <h3 className="book-title">
                        {meta.name || `Book #${id}`}
                      </h3>
                    </div>

                    <button className="btn owned" disabled>
                      ✓ Purchased
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )
      }

      {/* ---------- ADMIN ---------- */}


      {
        view === "admin" && (
          <section className="section admin">
            <h2>Admin Dashboard</h2>
            {!isAdmin && (
              <div className="admin-note">
                Only the admin wallet can use these controls.
              </div>
            )}

            <div
              className={
                isAdmin ? "admin-grid" : "admin-grid admin-locked"
              }
            >
              {/* Meta Card */}
              <div className="admin-card tiny">
                <h3>Add / Update Book</h3>
                <div className="form">
                  <label>Book ID</label>
                  <input
                    type="number"
                    value={adminBookId}
                    onChange={(e) => setAdminBookId(e.target.value)}
                  />

                  <label>Book Name</label>
                  <input
                    value={adminBookName}
                    onChange={(e) =>
                      setAdminBookName(e.target.value)
                    }
                  />

                  <label>Cover Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleImageUpload(e, adminBookId)
                    }
                  />

                  <div className="hint">
                    Image stays in browser even after refresh.
                  </div>

                  <button
                    className="btn"
                    onClick={isAdmin ? addOrUpdateBookMeta : undefined}
                  >
                    Save Meta
                  </button>
                </div>
              </div>

              {/* Price Card */}
              <div className="admin-card tiny">
                <h3>Set Book Price</h3>
                <div className="form">
                  <label>Book ID</label>
                  <input
                    type="number"
                    value={adminBookId}
                    onChange={(e) => setAdminBookId(e.target.value)}
                  />

                  <label>ETH Price</label>
                  <input
                    value={adminEthHuman}
                    onChange={(e) =>
                      setAdminEthHuman(e.target.value)
                    }
                    placeholder="e.g. 0.00001"
                  />

                  <label>JG Price</label>
                  <input
                    value={adminJgHuman}
                    onChange={(e) =>
                      setAdminJgHuman(e.target.value)
                    }
                    placeholder="e.g. 2"
                  />

                  <button
                    className="btn primary"
                    onClick={isAdmin ? adminSetPrice : undefined}
                    disabled={!isAdmin || setPriceLoading}
                  >
                    {setPriceLoading ? "Processing…" : "Save Prices"}
                  </button>
                </div>
              </div>

              {/* Token & Treasury */}
              <div className="admin-card tiny">
                <h3>Token & Treasury</h3>

                <div className="form">

                </div>

                <div className="form inline">
                  <button
                    className="btn"
                    onClick={isAdmin ? adminWithdrawEth : undefined}
                    disabled={!isAdmin || withdrawEthLoading}
                  >
                    {withdrawEthLoading ? "Processing…" : "Withdraw ETH"}
                  </button>

                  <button
                    className="btn"
                    onClick={isAdmin ? adminWithdrawToken : undefined}
                    disabled={!isAdmin || withdrawTokenLoading}
                  >
                    {withdrawTokenLoading ? "Processing…" : "Withdraw JG"}
                  </button>
                </div>

                <div className="form">
                  <label>Set Token Address</label>
                  <input
                    value={newTokenAddress}
                    onChange={(e) =>
                      setNewTokenAddress(e.target.value)
                    }
                    placeholder="0x..."
                  />

                  <button
                    className="btn"
                    onClick={isAdmin ? adminSetTokenAddress : undefined}
                    disabled={!isAdmin || setTokenAddrLoading}
                  >
                    {setTokenAddrLoading
                      ? "Processing…"
                      : "Update Token Address"}
                  </button>
                </div>
              </div>
            </div>


            <div className={`yt-row ${!isAdmin ? "admin-locked" : ""}`}>
              <h4>Add video link</h4>

              <input
                className="yt-input"
                placeholder="Paste YouTube link"
                value={ytLink}
                onChange={(e) => setYtLink(e.target.value)}
              />

              <button className="btn" onClick={saveYt}>
                Save
              </button>
            </div>



          </section>
        )
      }

      {/* ---------- Reader Modal ---------- */}
      {
        readerOpen && (
          <div
            className="modal"
            onClick={() => setReaderOpen(false)}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: "10px" }}>
                {bookMeta[readerBook]?.name ||
                  `Book #${readerBook}`}{" "}
                — Preview
              </h3>

              <div className="reader">
                <p>
                  <b>About This Demo</b> — This is a simple Web3 resume project
                  showing how a user can connect a wallet and buy a digital Book
                  using ETH or JG tokens on the Sepolia testnet.
                </p>

                <p>
                  <b>How It Works</b> — The dApp demonstrates basic smart
                  contract flow like approvals, buying, claiming tokens, and
                  loading content from IPFS. It’s made to show my Web3
                  development skills in a clean and easy way.
                </p>
              </div>

              <button
                className="btn"
                onClick={() => setReaderOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}

