import React, { useState, useEffect } from 'react';
import { Package, ShieldCheck, ShieldAlert, Activity, Cloud, Users, ArrowRight, RefreshCw } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import './App.css';

// --- 1. YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCcbd4jOi8v1hMSxBCdihtuhwNg0llLNRo",
  authDomain: "blockchainapp-ed1b0.firebaseapp.com",
  projectId: "blockchainapp-ed1b0",
  storageBucket: "blockchainapp-ed1b0.firebasestorage.app",
  messagingSenderId: "531306385986",
  appId: "1:531306385986:web:0dbabd733601f77e2253db",
  measurementId: "G-RQP2LJF4XG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
  const [formData, setFormData] = useState({ sender: '', receiver: '', item: '' });
  const [isValid, setIsValid] = useState(true);
  const [isMining, setIsMining] = useState(false);
  const [notification, setNotification] = useState(null);

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
    const genesisData = { sender: "System", receiver: "System", item: "Genesis Block" };
    const genesisBlock = mineBlock(0, "0", genesisData);
    try { await setDoc(doc(db, 'blockchain_data', 'block_0'), genesisBlock); } 
    catch (e) { console.error(e); }
  };

  const handleMine = async () => {
    if (!formData.sender || !formData.receiver || !formData.item) return;
    setIsMining(true);
    setTimeout(async () => {
      try {
        const latestBlock = blocks[blocks.length - 1];
        const newIndex = latestBlock.index + 1;
        const newBlock = mineBlock(newIndex, latestBlock.hash, formData);
        await setDoc(doc(db, 'blockchain_data', `block_${newIndex}`), newBlock);
        setFormData({ sender: '', receiver: '', item: '' });
        setNotification("Block Mined Successfully!");
        setTimeout(() => setNotification(null), 3000);
      } catch (error) { console.error(error); }
      setIsMining(false);
    }, 100);
  };

  const validateChain = (chain) => {
    let valid = true;
    for (let i = 1; i < chain.length; i++) {
      const curr = chain[i];
      const prev = chain[i - 1];
      if (curr.previousHash !== prev.hash) {
        valid = false;
        break;
      }
    }
    setIsValid(valid);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1><Cloud size={32} /> Global Ledger</h1>
        <p><Users size={16} /> Public • Shared • Persistent</p>
      </header>

      <div className="card">
        <div className="card-header">
          <Package className="icon-green" /> 
          <h2>New Transaction</h2>
        </div>
        <div className="form-row">
          <input type="text" placeholder="From" value={formData.sender} onChange={(e) => setFormData({...formData, sender: e.target.value})} />
          <input type="text" placeholder="To" value={formData.receiver} onChange={(e) => setFormData({...formData, receiver: e.target.value})} />
          <input type="text" placeholder="Item" value={formData.item} onChange={(e) => setFormData({...formData, item: e.target.value})} />
        </div>
        <button onClick={handleMine} disabled={isMining} className="mine-btn">
          {isMining ? <><RefreshCw className="spin" /> Mining...</> : <><Activity /> Mine Block</>}
        </button>
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
                <div className="data-label">PAYLOAD</div>
                <div className="data-flow">
                  <span>{block.data.sender}</span> <ArrowRight size={14} /> <span>{block.data.receiver}</span>
                </div>
                <div className="data-item">{block.data.item}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}