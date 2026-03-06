import React, { useState } from 'react';
import './AdminInput.css';
import axios from 'axios';

export default function AdminInput({ onAddGood }) {
    const [searchName, setSearchName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        if (!searchName.trim()) return;

        setIsLoading(true);
        try {
            const res = await axios.post('https://insightcart.onrender.com/addNewItem', { URL: searchName });
            alert(`Data fetched successfully: ${res.data.message}`);
            onAddGood();
            setSearchName(''); 
        } catch (err) {
            console.log('Error fetching or logging data:', err);
            alert('Error fetching or logging data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div className="inpForm">
            <input
                type="text"
                placeholder="URL"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
            />
            <button onClick={handleSend} disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send'}
            </button>
        </div>
    );
}