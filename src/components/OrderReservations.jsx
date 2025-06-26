import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';

// Noble Cut Gold/Black style
const GOLD = '#bfa653';
const RED = '#ff6b6b';
const BLACK = '#111';

const inputStyle = {
  padding: '8px 12px',
  borderRadius: 8,
  border: `1.5px solid ${GOLD}`,
  backgroundColor: BLACK,
  color: GOLD,
  marginRight: 12,
  fontSize: 14,
  width: 180,
  boxSizing: 'border-box',
};

const buttonStyle = {
  padding: '10px 22px',
  backgroundColor: GOLD,
  color: BLACK,
  borderRadius: 8,
  border: 'none',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: `0 0 12px ${GOLD}aa`,
  transition: 'background-color 0.3s ease',
};

function OrderReservations() {
  const [reservations, setReservations] = useState([]);
  const [rollsMap, setRollsMap] = useState({});
  const [clientSearch, setClientSearch] = useState('');
  const [fabricCodeSearch, setFabricCodeSearch] = useState('');

  // Fetch orders & rolls
  useEffect(() => {
    const fetchReservations = async () => {
      const snapshot = await getDocs(collection(db, 'orders'));
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        const assignedRolls = raw['Assigned Rolls'] || [];
        const orderDate =
          raw['Order Date'] || raw['Reservation Date'] || raw['reservationDate'] || raw['orderDate'] || '-';
        const baseEntry = {
          id: doc.id,
          client: raw['Client Name'] || raw['clientName'] || raw['Client'] || '',
          fabricCode: raw['Fabric Code'] || raw['fabricCode'] || '',
          description: raw['Fabric Description'] || raw['fabricDescription'] || '',
          reserved: (raw['Fabric Consumption'] || raw['fabricConsumption'] || 0) *
            (raw['Ordered Quantity'] || raw['orderedQuantity'] || 0),
          orderDate,
        };

        if (!assignedRolls.length) {
          return [baseEntry];
        }

        // One entry for each assigned roll
        return assignedRolls.map(roll => ({
          ...baseEntry,
          rollNumber: roll.rollNumber || '-',
          reserved: roll.reserved || 0,
        }));
      }).flat();
      setReservations(data);
    };

    const fetchRolls = async () => {
      const snapshot = await getDocs(collection(db, 'fabricRolls'));
      const map = {};
      snapshot.docs.forEach(doc => {
        const d = doc.data();
        if (!map[d.article]) map[d.article] = [];
        map[d.article].push({ ...d });
      });
      // FIFO order by roll number
      Object.keys(map).forEach(article => {
        map[article].sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));
      });
      setRollsMap(map);
    };

    fetchReservations();
    fetchRolls();
  }, []);

  // Filters
  const filteredReservations = reservations.filter(r =>
    (r.client || '').toLowerCase().includes(clientSearch.toLowerCase()) &&
    (r.fabricCode || '').toLowerCase().includes(fabricCodeSearch.toLowerCase())
  );

  // --- Export (keeps old logic) ---
  const exportToExcel = () => {
    const rollUsageTracker = {};
    const rows = [];

    filteredReservations.forEach(res => {
      const rolls = rollsMap[res.fabricCode] || [];
      let remaining = res.reserved;

      for (let i = 0; i < rolls.length && remaining > 0; i++) {
        const roll = rolls[i];
        const rollKey = roll.rollNumber;
        if (!rollUsageTracker[rollKey]) rollUsageTracker[rollKey] = 0;
        const available = Math.max(0, roll.totalMeters - rollUsageTracker[rollKey]);
        const toReserve = Math.min(available, remaining);

        if (toReserve > 0) {
          rollUsageTracker[rollKey] += toReserve;
          remaining -= toReserve;
          rows.push({
            'Order ID': res.id,
            'Client': res.client,
            'Fabric Code': res.fabricCode,
            'Description': res.description || '-',
            'Roll #': rollKey,
            'Reserved (mtrs)': toReserve.toFixed(2),
            'Status': 'OK',
            'Reservation Date': res.orderDate
          });
        }
      }
      if (remaining > 0) {
        rows.push({
          'Order ID': res.id,
          'Client': res.client,
          'Fabric Code': res.fabricCode,
          'Description': res.description || '-',
          'Roll #': '-',
          'Reserved (mtrs)': remaining.toFixed(2),
          'Status': 'Overbooked',
          'Reservation Date': res.orderDate
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservations');
    XLSX.writeFile(workbook, 'NobleCut_Reservations.xlsx');
  };

  // --- Display logic with gold/black visual ---
  return (
    <div style={{
      backgroundColor: BLACK,
      padding: 24,
      borderRadius: 24,
      maxWidth: 1050,
      margin: 'auto',
      color: GOLD,
      fontFamily: "'Playfair Display', serif",
      boxShadow: `0 4px 24px ${GOLD}33`
    }}>
      <h2 style={{
        textAlign: 'center',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 20,
        color: GOLD,
      }}>
        Order Reservations
      </h2>
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <input
          type="text"
          placeholder="Search Client"
          value={clientSearch}
          onChange={e => setClientSearch(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Search Fabric Code"
          value={fabricCodeSearch}
          onChange={e => setFabricCodeSearch(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={exportToExcel}
          style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#a68e36'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = GOLD}
        >
          Export to Excel
        </button>
      </div>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: "'Playfair Display', serif",
        fontWeight: 600,
        fontSize: '1rem',
        color: GOLD,
      }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${GOLD}` }}>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Order ID</th>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Client</th>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Fabric Code</th>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Description</th>
            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Roll #</th>
            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Reserved (mtrs)</th>
            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Status</th>
            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Reservation Date</th>
          </tr>
        </thead>
        <tbody>
          {/* Core FIFO visual logic */}
          {(() => {
            const rollUsageTracker = {};
            const displayRows = [];

            filteredReservations.forEach((res, idx) => {
              const rolls = rollsMap[res.fabricCode] || [];
              let remaining = res.reserved;

              for (let i = 0; i < rolls.length && remaining > 0; i++) {
                const roll = rolls[i];
                const rollKey = roll.rollNumber;
                if (!rollUsageTracker[rollKey]) rollUsageTracker[rollKey] = 0;
                const available = Math.max(0, roll.totalMeters - rollUsageTracker[rollKey]);
                const toReserve = Math.min(available, remaining);

                if (toReserve > 0) {
                  rollUsageTracker[rollKey] += toReserve;
                  remaining -= toReserve;
                  displayRows.push(
                    <tr key={`${res.id}-${rollKey}-${idx}`} style={{ color: GOLD, backgroundColor: idx % 2 === 0 ? '#121212' : '#1a1a1a' }}>
                      <td>{res.id}</td>
                      <td>{res.client}</td>
                      <td>{res.fabricCode}</td>
                      <td>{res.description || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{rollKey}</td>
                      <td style={{ textAlign: 'right' }}>{toReserve.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>OK</td>
                      <td style={{ textAlign: 'center' }}>{res.orderDate}</td>
                    </tr>
                  );
                }
              }
              if (remaining > 0) {
                displayRows.push(
                  <tr key={`${res.id}-over-${idx}`} style={{ color: RED, backgroundColor: idx % 2 === 0 ? '#121212' : '#1a1a1a' }}>
                    <td>{res.id}</td>
                    <td>{res.client}</td>
                    <td>{res.fabricCode}</td>
                    <td>{res.description || '-'}</td>
                    <td style={{ textAlign: 'center' }}>-</td>
                    <td style={{ textAlign: 'right' }}>{remaining.toFixed(2)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>Overbooked</td>
                    <td style={{ textAlign: 'center' }}>{res.orderDate}</td>
                  </tr>
                );
              }
            });
            return displayRows;
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default OrderReservations;
