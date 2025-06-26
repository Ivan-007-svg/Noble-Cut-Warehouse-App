import React, { useState } from 'react';

const GOLD = "#e2be6a";
const CARD_BG = "#181818";

function AddFabricRoll({ onAdd }) {
  const [formData, setFormData] = useState({
    supplier: '',
    article: '',
    color: '',
    description: '',
    rollNumber: '',
    totalMeters: ''
  });

  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      ...formData,
      totalMeters: Number(formData.totalMeters)
    });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setFormData({
      supplier: '',
      article: '',
      color: '',
      description: '',
      rollNumber: '',
      totalMeters: ''
    });
  };

  return (
    <div
      style={{
        maxWidth: '460px',
        margin: '2.5rem auto',
        padding: '2rem 2rem 1.5rem 2rem',
        border: `2px solid ${GOLD}`,
        borderRadius: 20,
        background: CARD_BG,
        boxShadow: "0 2px 24px #e2be6a30"
      }}
    >
      <h2
        style={{
          color: GOLD,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: 1,
          marginBottom: 26,
          marginTop: 0,
          fontFamily: "'Playfair Display', serif"
        }}
      >
        Add New Fabric Roll
      </h2>
      <form onSubmit={handleSubmit}>
        {['supplier', 'article', 'color', 'description', 'rollNumber', 'totalMeters'].map((field) => (
          <div key={field} style={{ marginBottom: '1.2rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: GOLD,
                fontWeight: 700,
                letterSpacing: 0.5
              }}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              type="text"
              name={field}
              value={formData[field]}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.62rem 0.8rem',
                border: `1.5px solid ${GOLD}`,
                borderRadius: 8,
                background: 'black',
                color: GOLD,
                fontWeight: 500,
                fontSize: 15,
                outline: 'none',
                transition: 'border 0.2s',
                fontFamily: "inherit"
              }}
              required
              autoComplete="off"
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            />
          </div>
        ))}
        <button
          type="submit"
          style={{
            width: '100%',
            backgroundColor: GOLD,
            color: 'black',
            padding: '0.75rem 0',
            fontWeight: 'bold',
            fontSize: 18,
            border: 'none',
            borderRadius: 11,
            marginTop: 10,
            boxShadow: "0 1px 8px #e2be6a60",
            cursor: "pointer",
            letterSpacing: 0.5
          }}
        >
          Add Roll
        </button>
      </form>
      {showSuccess && (
        <p style={{
          color: GOLD,
          textAlign: 'center',
          marginTop: '1.2rem',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: 0.2
        }}>
          Roll added successfully.
        </p>
      )}
    </div>
  );
}

export default AddFabricRoll;
