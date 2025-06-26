import React, { useState } from "react";
import AddFabricRoll from "./components/AddFabricRoll";
import FabricInventory from "./components/FabricInventory";
import OrderReservations from "./components/OrderReservations";
import CutOrders from "./components/CutOrders";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

const tabs = [
  { key: "add", label: "Add Fabric Roll" },
  { key: "inventory", label: "Inventory" },
  { key: "reservations", label: "Reservations" },
  { key: "cutorders", label: "Cut Orders" }
];

const GOLD = "#e2be6a";
const BLACK = "#111";
const LOGO_WIDTH = 140;

function App() {
  const [tab, setTab] = useState("inventory");
  const [refreshInventory, setRefreshInventory] = useState(0);

  async function handleAddRoll(data) {
    try {
      await addDoc(collection(db, "fabricRolls"), {
        ...data,
        reservedMeters: 0,
        availableMeters: Number(data.totalMeters),
      });
      setTab("inventory"); // Switch to Inventory tab after adding roll
      setRefreshInventory(r => r + 1); // Trigger Inventory refresh
    } catch (error) {
      alert("Error saving fabric roll: " + error.message);
    }
  }

  return (
    <div style={{ background: BLACK, minHeight: "100vh", fontFamily: "serif" }}>
      <header
        style={{
          paddingTop: 48,
          paddingBottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <img
          src="/logo.png"
          alt="Noble Cut"
          style={{
            width: LOGO_WIDTH,
            marginBottom: 14,
            display: "block",
            filter: "drop-shadow(0 0 8px #e2be6a44)",
          }}
        />
        <h1
          style={{
            color: GOLD,
            fontFamily: "'Playfair Display', 'serif'",
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: 2,
            marginBottom: 26,
            textAlign: "center",
            textShadow: "0 2px 12px #000a",
            lineHeight: 1.13,
          }}
        >
          Warehouse App
        </h1>
        <div style={{
          display: "flex",
          gap: 18,
          marginBottom: 44,
          justifyContent: "center"
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 28px",
                background: tab === t.key ? GOLD : "transparent",
                color: tab === t.key ? BLACK : GOLD,
                border: `2px solid ${GOLD}`,
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 17,
                fontFamily: "'Inter', 'serif', 'sans-serif'",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s, boxShadow 0.16s",
                outline: "none",
                boxShadow: tab === t.key
                  ? "0 4px 12px #e2be6a33"
                  : "none",
                letterSpacing: 0.5,
                minWidth: 150,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <main style={{
        maxWidth: 1050,
        margin: "0 auto",
        background: "rgba(18, 18, 18, 0.97)",
        borderRadius: 32,
        boxShadow: "0 2px 40px #e2be6a12",
        padding: "40px 32px 56px 32px",
        minHeight: 580,
      }}>
        {tab === "add" && <AddFabricRoll onAdd={handleAddRoll} />}
        {tab === "inventory" && <FabricInventory refresh={refreshInventory} />}
        {tab === "reservations" && <OrderReservations />}
        {tab === "cutorders" && <CutOrders />}
      </main>
    </div>
  );
}

export default App;
