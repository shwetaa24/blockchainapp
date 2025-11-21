import React, { useState, useEffect } from 'react';
import { Package, ShieldCheck, ShieldAlert, Activity, Cloud, Users, ArrowRight, RefreshCw, Wallet, DollarSign, ShoppingCart, CreditCard } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import './App.css';

// --- 1. CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCcbd4jOi8v1hMSxBCdihtuhwNg0llLNRo",
  authDomain: "blockchainapp-ed1b0.firebaseapp.com",
  projectId: "blockchainapp-ed1b0",
  storageBucket: "blockchainapp-ed1b0.firebasestorage.app",
  messagingSenderId: "531306385986",
  appId: "1:531306385986:web:0dbabd733601f77e2253db",
  measurementId: "G-RQP2LJF4XG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- NEW: PRODUCT LIST (CATALOG) ---
const PRODUCTS = [
  { id: 'coffee', name: '☕ Premium Coffee (1kg)', price: 25 },
  { id: 'tea', name: '🍵 Green Tea Box', price: 12 },
  { id: 'cup', name: '🥤 Ceramic Mug', price: 8 },
  { id: 'machine', name: '⚙️ Espresso Machine', price: 450 },
  { id: 'ship', name: '🚢 Shipping Container', price: 2500 },
];

// --- 2. BLOCKCHAIN LOGIC ---
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const calculateHash = (index, previousHash, timestamp, data, nonce) => {
  return simpleHash(index + previousHash + timestamp + JSON.stringify(data) + nonce);
};

const mineBlock = (index, previousHash, data, difficulty = 2) => {
  let nonce = 0;
  let timestamp = new Date().toISOString();
  let hash = calculateHash(index, previousHash, timestamp, data, nonce);
  let attempts = 0;
  while (hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
    nonce++;
    hash = calculateHash(index, previousHash, timestamp, data, nonce);
    attempts++;
    if (attempts > 100000) break;
  }
  return { index, timestamp, data, previousHash, hash, nonce };
};

// --- 3. APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [blocks, setBlocks] = useState([]);
  
  // NEW: Form now tracks product selection
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(PRODUCTS[0].id);
  const [quantity, setQuantity] = useState(1);

  const [isValid, setIsValid] = useState(true);
  const [isMining, setIsMining] = useState(false);
  const [notification, setNotification] = useState(null);
  const [balance, setBalance] = useState(5000); 

  // Calculate totals automatically
  const selectedProduct = PRODUCTS.find(p => p.id === selectedProductId);
  const totalAmount = selectedProduct.price * quantity;

  useEffect(() => {
    signInAnonymously(auth).catch((error) => console.error("Auth Error:", error));
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'blockchain_data');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBlocks = snapshot.docs.map(doc => doc.data());
      fetchedBlocks.sort((a, b) => a.index - b.index);
      if (fetchedBlocks.length === 0) {
        createGenesisBlock();
      } else {
        setBlocks(fetchedBlocks);
        validateChain(fetchedBlocks);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const createGenesisBlock = async () => {
    const genesisData = { sender: "System", receiver: "System", item: "Genesis Block", amount: "$0" };
    const genesisBlock = mineBlock(0, "0", genesisData);
    try { await setDoc(doc(db, 'blockchain_data', 'block_0'), genesisBlock); } 
    catch (e) { console.error(e); }
  };

  const processPayment = async (method) => {
    if (!sender || !receiver) {
      showToast("Please enter Sender and Receiver names!"); return;
    }
    if (method === 'WALLET' && totalAmount > balance) {
      showToast("Insufficient Wallet Funds!"); return;
    }

    setIsMining(true);
    
    if (method === 'STRIPE') showToast("Processing Card...");

    setTimeout(async () => {
      try {
        const latestBlock = blocks[blocks.length - 1];
        const newIndex = latestBlock.index + 1;
        
        // Create detailed receipt data
        const transactionData = {
            sender: sender,
            receiver: receiver,
            item: `${quantity}x ${selectedProduct.name}`, // "2x Coffee"
            amount: `$${totalAmount.toFixed(2)}`,       // "$50.00"
            method: method
        };

        const newBlock = mineBlock(newIndex, latestBlock.hash, transactionData);
        await setDoc(doc(db, 'blockchain_data', `block_${newIndex}`), newBlock);
        
        if (method === 'WALLET') setBalance(prev => prev - totalAmount);
        
        setSender('');
        setReceiver('');
        showToast("Purchase Successful!");
      } catch (error) { console.error(error); }
      setIsMining(false);
    }, method === 'STRIPE' ? 2000 : 500);
  };

  const validateChain = (chain) => {
    let valid = true;
    for (let i = 1; i < chain.length; i++) {
      const curr = chain[i];
      const prev = chain[i - 1];
      if (curr.hash !== calculateHash(curr.index, curr.previousHash, curr.timestamp, curr.data, curr.nonce) || curr.previousHash !== prev.hash) {
        valid = false;
        break;
      }
    }
    setIsValid(valid);
  };

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1><Cloud size={32} /> Global Market</h1>
        <p><Users size={16} /> Secure Blockchain Store</p>
      </header>

      <div className="card" style={{ borderColor: '#34d399', borderLeftWidth: '5px' }}>
          <div className="card-header">
              <Wallet className="icon-green" />
              <h2>My Wallet</h2>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#34d399' }}>
              ${balance.toFixed(2)}
          </div>
      </div>

      <div className="card">
        <div className="card-header">
          <ShoppingCart className="icon-green" /> 
          <h2>Select Items</h2>
        </div>
        
        {/* PRODUCT SELECTION ROW */}
        <div className="form-row">
          <input type="text" placeholder="Buyer Name (You)" value={sender} onChange={(e) => setSender(e.target.value)} />
          <input type="text" placeholder="Seller Name (Store)" value={receiver} onChange={(e) => setReceiver(e.target.value)} />
        </div>

        <div className="form-row">
          {/* Product Dropdown */}
          <select 
            value={selectedProductId} 
            onChange={(e) => setSelectedProductId(e.target.value)}
            style={{ 
              padding: '12px', borderRadius: '6px', backgroundColor: '#334155', 
              color: 'white', border: '1px solid #475569', outline: 'none' 
            }}
          >
            {PRODUCTS.map(p => (
              <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
            ))}
          </select>

          {/* Quantity Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Qty:</span>
            <input 
              type="number" min="1" value={quantity} 
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
            />
          </div>
        </div>

        {/* TOTAL PRICE DISPLAY */}
        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
          Total: ${totalAmount.toFixed(2)}
        </div>
        
        <div style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
            <button onClick={() => processPayment('WALLET')} disabled={isMining} className="mine-btn">
              {isMining ? <RefreshCw className="spin" /> : <Wallet size={20} />} Pay with Wallet
            </button>
            <button 
                onClick={() => processPayment('STRIPE')} 
                disabled={isMining} 
                className="mine-btn" 
                style={{ backgroundColor: '#635bff' }} 
            >
              {isMining ? <RefreshCw className="spin" /> : <CreditCard size={20} />} Pay with Card
            </button>
        </div>
      </div>

      <div className={`status-badge ${isValid ? 'secure' : 'danger'}`}>
        {isValid ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        <span>{isValid ? 'CHAIN SECURE' : 'TAMPER DETECTED'}</span>
      </div>

      {notification && <div className="toast">{notification}</div>}

      <div className="chain-container">
        {blocks.map((block, i) => (
          <div key={block.hash} className="block-wrapper">
            {i > 0 && <div className="chain-link"></div>}
            <div className={`block-card ${!isValid ? 'error-border' : ''}`}>
              <div className="block-info">
                <div className="block-meta">
                  <span className="badge">BLOCK #{block.index}</span>
                  <span className="timestamp">{new Date(block.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="hash-row">Hash: <span>{block.hash.substring(0, 15)}...</span></div>
                <div className="hash-row">Prev: <span>{block.previousHash ? block.previousHash.substring(0, 15) : '0'}...</span></div>
              </div>
              <div className="block-data">
                <div className="data-label">
                    {block.data.method ? block.data.method : 'DATA'}
                </div>
                <div className="data-flow">
                  <span>{block.data.sender}</span> <ArrowRight size={14} /> <span>{block.data.receiver}</span>
                </div>
                {/* Display Item AND Price */}
                <div className="data-item">{block.data.item}</div>
                <div className="data-item" style={{ color: '#34d399', fontSize: '1.1rem' }}>
                    {block.data.amount}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}