import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, deleteDoc, updateDoc, runTransaction, query } from 'firebase/firestore';
import { db } from '../firebase';
import Modal from 'react-modal';

const GOLD = '#bfa653';
const RED = '#ff6b6b';
const ORANGE = '#f0a500';
const BLACK = '#111';

const inputStyle = {
  backgroundColor: '#222',
  border: `1.5px solid ${GOLD}`,
  borderRadius: 8,
  color: GOLD,
  padding: '10px 12px',
  width: '100%',
  marginBottom: 18,
  fontSize: '1rem',
  boxSizing: 'border-box',
};

const selectStyle = {
  backgroundColor: '#222',
  border: `1.5px solid ${GOLD}`,
  borderRadius: 8,
  color: GOLD,
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
};

const buttonStyle = {
  backgroundColor: 'transparent',
  color: GOLD,
  border: `1px solid ${GOLD}`,
  borderRadius: 6,
  padding: '6px 12px',
  cursor: 'pointer',
  marginRight: 8,
  transition: 'all 0.3s ease',
};

const buttonHoverStyle = {
  backgroundColor: GOLD,
  color: BLACK,
  borderColor: '#a68e36',
};

const modalStyle = {
  content: {
    backgroundColor: BLACK,
    color: GOLD,
    borderRadius: 12,
    padding: 24,
    maxWidth: 600,
    margin: 'auto',
    boxShadow: `0 0 24px ${GOLD}aa`,
    fontFamily: "'Playfair Display', serif",
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
};

const modalButtonStyle = {
  backgroundColor: GOLD,
  border: 'none',
  padding: '10px 20px',
  borderRadius: 8,
  color: BLACK,
  fontWeight: 700,
  cursor: 'pointer',
  marginRight: 12,
};

function FabricInventory(props) {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const [supplierSearch, setSupplierSearch] = useState('');
  const [colorSearch, setColorSearch] = useState('');
  const [descriptionSearch, setDescriptionSearch] = useState('');

  const [editHover, setEditHover] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

  // --- Healing logic for overbooked fabric rolls ---
  async function reallocateOverbookedAndSyncFirestore(rolls) {
    for (let i = 0; i < rolls.length; i++) {
      const roll = rolls[i];
      if (roll.availableMeters < 0) {
        const deficit = -roll.availableMeters;

        // Old roll becomes fully reserved, no available left
        rolls[i].reservedMeters = rolls[i].totalMeters;
        rolls[i].availableMeters = 0;

        // Look ahead for the next roll with available meters
        for (let j = i + 1; j < rolls.length && deficit > 0; j++) {
          const nextRoll = rolls[j];
          const availableOnNext = nextRoll.totalMeters - (nextRoll.reservedMeters || 0);

          if (availableOnNext > 0) {
            const transferMeters = Math.min(availableOnNext, deficit);

            // New roll takes on the minus reservation
            rolls[j].reservedMeters = (nextRoll.reservedMeters || 0) + transferMeters;
            rolls[j].availableMeters = nextRoll.totalMeters - rolls[j].reservedMeters;

            // Update Firestore inside a transaction
            await runTransaction(db, async (transaction) => {
              const rollRef = doc(db, 'fabricRolls', roll.id);
              const nextRollRef = doc(db, 'fabricRolls', nextRoll.id);

              transaction.update(rollRef, {
                reservedMeters: rolls[i].reservedMeters,
                availableMeters: rolls[i].availableMeters,
              });
              transaction.update(nextRollRef, {
                reservedMeters: rolls[j].reservedMeters,
                availableMeters: rolls[j].availableMeters,
              });
            });

            // After transferring, break out of the loop (no more minus left)
            break;
          }
        }
      }
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, 'fabricRolls'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => {
        if (a.article === b.article) {
          return (a.rollNumber || '').localeCompare(b.rollNumber || '');
        }
        return (a.article || '').localeCompare(b.article || '');
      });

      await reallocateOverbookedAndSyncFirestore(sorted);

      const finalSnapshot = await getDocs(collection(db, 'fabricRolls'));
      const finalData = finalSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        availableMeters: doc.data().totalMeters - doc.data().reservedMeters,
      }));
      setInventory(finalData);
      setFilteredInventory(finalData);
    };
    fetchData();
  }, [props.refresh]);

  useEffect(() => {
    const filtered = inventory.filter(item =>
      item.supplier.toLowerCase().includes(supplierSearch.toLowerCase()) &&
      item.color.toLowerCase().includes(colorSearch.toLowerCase()) &&
      item.description.toLowerCase().includes(descriptionSearch.toLowerCase())
    );
    setFilteredInventory(filtered);
  }, [supplierSearch, colorSearch, descriptionSearch, inventory]);

  const openEditModal = (item) => {
    setEditData({ ...item });
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setEditData(null);
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  // ---- ENHANCED: Save Total, Reserved, and Available ----
  const handleSaveEdit = async () => {
    const docRef = doc(db, 'fabricRolls', editData.id);
    const totalMeters = parseFloat(editData.totalMeters) || 0;
    const reservedMeters = parseFloat(editData.reservedMeters) || 0;
    const availableMeters = totalMeters - reservedMeters;
    const updatedData = {
      color: editData.color,
      description: editData.description,
      totalMeters,
      reservedMeters,
      availableMeters,
      lastEditedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, updatedData);
    closeModal();
    // Refresh inventory by forcing parent refresh (if needed)
  };
  // -------------------------------------------------------

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'fabricRolls', id));
    // Refresh inventory by forcing parent refresh
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredInventory.map(item => ({
      Supplier: item.supplier,
      Article: item.article,
      Color: item.color,
      Description: item.description,
      'Roll #': item.rollNumber,
      'Total (mtrs)': item.totalMeters,
      'Reserved (mtrs)': item.reservedMeters,
      'Available (mtrs)': item.availableMeters,
      'Stock Status': item.availableMeters < 0 ? 'Overbooked' :
        item.availableMeters <= 5 ? 'Low' : 'OK',
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, 'FabricInventory.xlsx');
  };

  const uniqueSuppliers = [...new Set(inventory.map(item => item.supplier))];
  const uniqueColors = [...new Set(inventory.map(item => item.color))];
  const uniqueDescriptions = [...new Set(inventory.map(item => item.description))];

  return (
    <div style={{
      backgroundColor: BLACK,
      borderRadius: 24,
      padding: 24,
      color: GOLD,
      fontFamily: "'Playfair Display', serif",
      maxWidth: 1050,
      margin: "auto",
      boxShadow: `0 4px 24px ${GOLD}33`
    }}>

      {/* Title and Filters */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: 28,
          fontWeight: '700',
          color: GOLD,
          marginBottom: 20,
        }}>
          Fabric Inventory
        </h2>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
            <input
              type="text"
              placeholder="Search Supplier"
              value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)}
              style={inputStyle}
            />
            <select
              value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Suppliers</option>
              {uniqueSuppliers.map((supplier, idx) => (
                <option key={idx} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
            <input
              type="text"
              placeholder="Search Color"
              value={colorSearch}
              onChange={e => setColorSearch(e.target.value)}
              style={inputStyle}
            />
            <select
              value={colorSearch}
              onChange={e => setColorSearch(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Colors</option>
              {uniqueColors.map((color, idx) => (
                <option key={idx} value={color}>{color}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
            <input
              type="text"
              placeholder="Search Description"
              value={descriptionSearch}
              onChange={e => setDescriptionSearch(e.target.value)}
              style={inputStyle}
            />
            <select
              value={descriptionSearch}
              onChange={e => setDescriptionSearch(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Descriptions</option>
              {uniqueDescriptions.map((desc, idx) => (
                <option key={idx} value={desc}>{desc}</option>
              ))}
            </select>
          </div>

          <button
            onClick={exportToExcel}
            style={{
              backgroundColor: GOLD,
              color: BLACK,
              fontWeight: '700',
              padding: '10px 22px',
              borderRadius: 8,
              cursor: 'pointer',
              border: 'none',
              fontSize: 14,
              boxShadow: `0 0 12px ${GOLD}aa`,
              transition: 'background-color 0.3s ease',
              minHeight: 50,
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#a68e36'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = GOLD}
          >
            Export to Excel
          </button>
        </div>
      </div>

      {/* Inventory Table */}
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
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Supplier</th>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Article</th>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Color</th>
            <th style={{ padding: '12px 8px', textAlign: 'left' }}>Description</th>
            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Roll #</th>
            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Total (mtrs)</th>
            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Reserved (mtrs)</th>
            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Available (mtrs)</th>
            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Stock Status</th>
            <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredInventory.map((item, index) => (
            <tr
              key={item.id}
              style={{
                backgroundColor: index % 2 === 0 ? '#121212' : '#1a1a1a',
                color: GOLD,
              }}
            >
              <td>{item.supplier}</td>
              <td>{item.article}</td>
              <td>{item.color}</td>
              <td>{item.description}</td>
              <td style={{ textAlign: 'center' }}>{item.rollNumber}</td>
              <td style={{ textAlign: 'right' }}>{item.totalMeters}</td>
              <td style={{ textAlign: 'right' }}>{item.reservedMeters}</td>
              <td
                style={{
                  textAlign: 'right',
                  color:
                    item.availableMeters < 0
                      ? RED
                      : item.availableMeters <= 5
                      ? ORANGE
                      : GOLD,
                  fontWeight: '700',
                }}
              >
                {item.availableMeters.toFixed(2)}
              </td>
              <td
                style={{
                  textAlign: 'center',
                  color:
                    item.availableMeters < 0
                      ? RED
                      : item.availableMeters <= 5
                      ? ORANGE
                      : GOLD,
                  fontWeight: '700',
                }}
              >
                {item.availableMeters < 0
                  ? 'Overbooked'
                  : item.availableMeters <= 5
                  ? 'Low'
                  : 'OK'}
              </td>
              <td style={{ textAlign: 'center' }}>
                <button
                  style={editHover ? { ...buttonStyle, ...buttonHoverStyle } : buttonStyle}
                  onMouseEnter={() => setEditHover(true)}
                  onMouseLeave={() => setEditHover(false)}
                  onClick={() => openEditModal(item)}
                >
                  Edit
                </button>
                <button
                  style={deleteHover ? { ...buttonStyle, ...buttonHoverStyle } : buttonStyle}
                  onMouseEnter={() => setDeleteHover(true)}
                  onMouseLeave={() => setDeleteHover(false)}
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={modalStyle}
        contentLabel="Edit Fabric Roll"
      >
        {editData && (
          <div>
            <h2 style={{ marginBottom: 20 }}>Edit Fabric Roll</h2>
            <label style={{ color: GOLD, marginBottom: 4, display: "block", fontWeight: 700 }}>
              Color
            </label>
            <input
              style={inputStyle}
              type="text"
              value={editData.color}
              onChange={(e) => handleEditChange('color', e.target.value)}
              placeholder="Color"
            />
            <label style={{ color: GOLD, marginBottom: 4, display: "block", fontWeight: 700 }}>
              Description
            </label>
            <input
              style={inputStyle}
              type="text"
              value={editData.description}
              onChange={(e) => handleEditChange('description', e.target.value)}
              placeholder="Description"
            />
            <label style={{ color: GOLD, marginBottom: 4, display: "block", fontWeight: 700 }}>
              Total Meters
            </label>
            <input
              style={inputStyle}
              type="number"
              value={editData.totalMeters}
              onChange={(e) => handleEditChange('totalMeters', e.target.value)}
              placeholder="Total Meters"
            />
            <label style={{ color: GOLD, marginBottom: 4, display: "block", fontWeight: 700 }}>
              Reserved Meters
            </label>
            <input
              style={inputStyle}
              type="number"
              value={editData.reservedMeters}
              onChange={(e) => handleEditChange('reservedMeters', e.target.value)}
              placeholder="Reserved Meters"
            />
            <label style={{ color: GOLD, marginBottom: 4, display: "block", fontWeight: 700 }}>
              Available Meters
            </label>
            <input
              style={{ ...inputStyle, backgroundColor: "#222", color: "#888", fontWeight: 700 }}
              type="number"
              value={
                Number(editData.totalMeters || 0) -
                Number(editData.reservedMeters || 0)
              }
              readOnly
              placeholder="Available Meters"
            />
            <div style={{ marginTop: 16 }}>
              <button style={modalButtonStyle} onClick={handleSaveEdit}>Save</button>
              <button style={modalButtonStyle} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default FabricInventory;
