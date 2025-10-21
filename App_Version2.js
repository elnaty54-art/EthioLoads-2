import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Package, List, RefreshCw, XCircle, CheckCircle, Database } from 'lucide-react';

// --- Firebase Imports and Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, updateDoc, onSnapshot, collection, query, addDoc, serverTimestamp } from 'firebase/firestore';

// Environment Variables for Render Hosting
const appId = process.env.REACT_APP_APP_ID || 'ethioloads-app';
const firebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG
  ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG)
  : {
      // Example fallback config (replace with real values for deployment)
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID",
    };
const initialAuthToken = process.env.REACT_APP_INITIAL_AUTH_TOKEN || null;

// Mock data for seeding
const initialLoadData = [
  { pickup: 'Bole Area', dropoff: 'Megenagna', status: 'Pending', driverId: null, distance: '12 km', price: 'ETB 850', type: 'Small Van' },
  { pickup: 'CMC Road', dropoff: 'Adama Dry Port', status: 'In Transit', driverId: 'D-452', distance: '102 km', price: 'ETB 4,500', type: 'Heavy Truck' },
  { pickup: 'Jemo', dropoff: 'Kality Ring Road', status: 'Completed', driverId: 'D-119', distance: '18 km', price: 'ETB 1,200', type: 'Pickup' },
  { pickup: 'Sarbet', dropoff: 'Mexico Square', status: 'Cancelled', driverId: null, distance: '7 km', price: 'ETB 500', type: 'Small Van' },
];

const App = () => {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Initialize Firebase and Authentication
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authService = getAuth(app);

      setDb(firestore);

      onAuthStateChanged(authService, async (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          if (initialAuthToken) {
            await signInWithCustomToken(authService, initialAuthToken);
          } else {
            await signInAnonymously(authService);
          }
        }
      });
    } catch (e) {
      console.error("Firebase initialization error:", e);
      setLoading(false);
      setModalMessage("Error connecting to the backend. Check console for details.");
      setIsModalOpen(true);
    }
  }, []);

  // Real-time Firestore Listener
  useEffect(() => {
    if (!isAuthReady || !db) return;
    setLoading(true);

    const loadsCollectionPath = `/artifacts/${appId}/public/data/loads`;
    const q = query(collection(db, loadsCollectionPath));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLoads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setLoads(fetchedLoads);
      setLoading(false);
    }, (error) => {
      console.error("Firestore real-time error:", error);
      setLoading(false);
      setModalMessage("Failed to fetch real-time data.");
      setIsModalOpen(true);
    });

    return () => unsubscribe();
  }, [isAuthReady, db]);

  // Seed Test Data
  const seedData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const loadsCollectionRef = collection(db, `/artifacts/${appId}/public/data/loads`);
      for (const load of initialLoadData) {
        await addDoc(loadsCollectionRef, {
          ...load,
          createdAt: serverTimestamp(),
          dispatch_user: userId 
        });
      }
      setModalMessage('4 test loads added to the database!');
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error seeding data:", error);
      setModalMessage('Error seeding data. Check console.');
      setIsModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Assign Driver to Load
  const handleAssignLoad = async (loadId) => {
    if (!db) return;
    try {
      const loadRef = doc(db, `/artifacts/${appId}/public/data/loads`, loadId);
      await updateDoc(loadRef, {
        status: 'In Transit',
        driverId: `D-${Math.floor(100 + Math.random() * 900)}`,
        assignedAt: serverTimestamp(),
        assignedBy: userId
      });
      setModalMessage(`Load ${loadId} assigned and status updated!`);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error assigning load:", error);
      setModalMessage(`Failed to assign load ${loadId}. Check console.`);
      setIsModalOpen(true);
    }
  };

  // UI helpers
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'In Transit': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const StatusBadge = ({ status }) => (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(status)}`}>
      {status}
    </span>
  );

  const LoadCard = ({ load }) => (
    <div className="bg-white p-6 shadow-xl rounded-2xl transition duration-300 hover:shadow-2xl hover:scale-[1.01] border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center">
          <Package className="w-5 h-5 mr-2 text-indigo-600" />
          {load.id}
        </h3>
        <StatusBadge status={load.status} />
      </div>
      <div className="space-y-3 text-sm text-gray-600">
        <div className="flex items-center">
          <MapPin className="w-4 h-4 mr-2 text-red-500" />
          <p><span className="font-semibold text-gray-700">Pickup:</span> {load.pickup}</p>
        </div>
        <div className="flex items-center">
          <MapPin className="w-4 h-4 mr-2 text-green-500" />
          <p><span className="font-semibold text-gray-700">Dropoff:</span> {load.dropoff}</p>
        </div>
        <div className="flex items-center">
          <Truck className="w-4 h-4 mr-2 text-indigo-500" />
          <p><span className="font-semibold text-gray-700">Driver ID:</span> {load.driverId || 'N/A'}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
        <p className="text-2xl font-extrabold text-indigo-600">{load.price}</p>
        <p className="text-sm text-gray-500">{load.distance}</p>
      </div>
      <div className="mt-4 flex space-x-2">
        <button
          onClick={() => handleAssignLoad(load.id)}
          className="flex-1 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition disabled:bg-gray-400"
          disabled={load.status !== 'Pending' || loading}
        >
          Assign Driver
        </button>
        <button
          onClick={() => setModalMessage(`Tracking logic for Load ${load.id} would initiate here. Requires real-time GPS integration.`)}
          className="flex-1 px-4 py-2 border border-indigo-500 text-indigo-500 text-sm font-medium rounded-lg hover:bg-indigo-50 transition"
        >
          Track
        </button>
      </div>
    </div>
  );

  const Modal = ({ message, isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-full">
          <div className="flex flex-col items-center">
            {message.includes('Error') ? (
              <XCircle className="w-10 h-10 text-red-500 mb-3" />
            ) : (
              <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
            )}
            <h4 className="text-lg font-bold text-gray-800 mb-2">{message.includes('Error') ? 'Alert' : 'Success!'}</h4>
            <p className="text-sm text-gray-600 text-center mb-4">{message}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      <Modal message={modalMessage} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 flex items-center">
          <Truck className="w-8 h-8 mr-3 text-indigo-600" />
          EthioLoads Dispatch Center
        </h1>
        <p className="text-gray-500 mt-1">
          Real-time logistics management for Addis Ababa.
          <span className="font-mono text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-2">
            User ID: {userId || 'Authenticating...'}
          </span>
        </p>
      </header>
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-semibold text-gray-700 flex items-center">
          <List className="w-5 h-5 mr-2" />
          Current Loads ({loads.length})
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={seedData}
            className="px-4 py-2 border border-green-500 text-green-600 rounded-lg shadow-md hover:bg-green-50 transition flex items-center disabled:opacity-50"
            disabled={loading}
          >
            <Database className="w-4 h-4 mr-2" />
            Seed Test Data
          </button>
          <button
            onClick={() => { }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition flex items-center disabled:bg-indigo-300"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Connecting...' : 'Real-time Connected'}
          </button>
        </div>
      </section>
      {loading && !loads.length ? (
        <div className="text-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-indigo-600 mt-4 font-medium">Connecting to your cloud backend...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loads.length === 0 ? (
            <div className="lg:col-span-3 text-center p-12 bg-white rounded-xl shadow-inner">
              <Database className="w-10 h-10 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No loads found in the database. Click "Seed Test Data" to begin testing.</p>
            </div>
          ) : (
            loads.map(load => (
              <LoadCard key={load.id} load={load} />
            ))
          )}
        </div>
      )}
      <footer className="mt-12 text-center text-sm text-gray-400 border-t pt-6">
        <p>EthioLoads &copy; 2025. Running on Render with Firestore for real-time logistics data.</p>
      </footer>
    </div>
  );
};

export default App;