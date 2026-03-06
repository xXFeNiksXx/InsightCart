import React, { useState, useEffect } from 'react';
import './ListOfGoods.css';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPaperclip, faTrashCan, faSquareCheck, 
    faPlus, faMinus, faLightbulb, faXmark, faSpinner 
} from '@fortawesome/free-solid-svg-icons';

export default function ListOfGoods({ refreshGoods }) {
    const [goods, setGoods] = useState([]);
    const [rec, setRec] = useState({});
    const [activeRecId, setActiveRecId] = useState(null); 
    const [curPage, setCurPage] = useState(1);
    const [isLoadMore, setIsLoadMore] = useState(false);
    const [isInitLoad, setIsInitLoad] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const getGoods = () => {
        axios.get('https://insightcart.onrender.com/items')
            .then(
                res => setGoods(res.data.reverse())
            )
            .catch(err => console.error('Error fetching goods:', err));
    };

    useEffect(() => {
        getGoods();
    }, [refreshGoods]);

    const getRecommendations = async (id) => {
        setActiveRecId(id);
        setCurPage(1);
        setHasMore(true);
        setIsInitLoad(true);

        try {
            const res = await axios.get(`https://insightcart.onrender.com/recomendations/${id}?page=1`);
            setRec(prev => ({ ...prev, [id]: res.data }));
            if (res.data.length === 0) {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Error fetching rec:', err);
        } finally {
            setIsInitLoad(false);
        }
    };

    const loadMore = async (id) => {
        setIsLoadMore(true);
        const nextPage = curPage + 1;
        
        try {
            const res = await axios.get(`https://insightcart.onrender.com/recomendations/${id}?page=${nextPage}`);
            
            if (res.data.length > 0) {
                setRec(prev => ({
                    ...prev,
                    [id]: [...(prev[id] || []), ...res.data]
                }));
                setCurPage(nextPage);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error("Error fetching rec:", err);
            setHasMore(false);
        } finally {
            setIsLoadMore(false);
        }
    };


    const [notification, setNotification] = useState(null);

    const showToast = (message) => {
        setNotification(message);
        setTimeout(() => setNotification(null), 3000);
    };

    const getUpdate = async (url) => {
        try {
            await axios.post('/updateItem', { url });
            await getGoods();
            showToast('Data successfully updated');
        } catch (err) {
            console.log('Error fetching update:', err);
        }
    };

    const deleteItem = async (id) => {
        try {
            await axios.delete(`https://insightcart.onrender.com/deleteItem/${id}`);
            setGoods(prevGoods => prevGoods.filter(item => item._id !== id));
        } catch (err) {
            console.log('Error deleting item:', err);
        }
    };

    return (
        <div className='goodsContainer'>
            {goods.map(item => (
                <div className='items' key={item._id}>
                    <div className="itemImgContainer">
                        <img src={item.image} alt={item.title} className='itemImage' />
                    </div>
                    <p className='itemTitle'>{item.title}</p>
                    <p className='itemPrice'>{item.price}</p>
                    <p>{item.status ? 'Available' : 'Not available'}</p>
                    
                    <a target='_blank' rel='noopener noreferrer' href={item.url} className='viewBtn'>
                        <FontAwesomeIcon icon={faPaperclip} style={{ marginRight: '5px' }} /> View
                    </a>

                    <div className="itemButs">
                        <button className='updateBtn' onClick={() => getUpdate(item.url)}>
                            <FontAwesomeIcon icon={faSquareCheck} style={{ marginRight: '5px' }} /> Check update
                        </button>
                        <button onClick={() => deleteItem(item._id)} className='deleteBtn'>
                            <FontAwesomeIcon icon={faTrashCan} style={{ marginRight: '5px' }} /> Delete
                        </button>
                        <button className='recommendBtn' onClick={() => getRecommendations(item._id)}>
                            <FontAwesomeIcon icon={faLightbulb} style={{ marginRight: '5px' }} /> Recommend
                        </button>
                    </div>
                </div>
            ))}

            {notification && (
                <div className="toastPopup">
                    <FontAwesomeIcon icon={faSquareCheck} style={{ marginRight: '10px' }} />
                    {notification}
                </div>
            )}

            {activeRecId && (
                <div className="modalOverlay" onClick={() => setActiveRecId(null)}>
                    <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                        <button className="closeX" onClick={() => setActiveRecId(null)}>
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                        
                        <h2 className="modalTitle">Recommendations (Page {curPage})</h2>
                        <hr />
                        
                        <div className="modalBody">
                            {isInitLoad ? (
                                <div className="loaderWrap">
                                    <p>Searching...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="recList">
                                        {rec[activeRecId]?.map((rec, index) => (
                                            <div key={index} className="recCard">
                                                <img src={rec.image} alt={rec.title} className="recImg" />
                                                <div className="recDetails">
                                                    <p className="recTitle">{rec.title}</p>
                                                    <p className="recPrice">{rec.priceText}</p>
                                                    <p className={`recStatus ${rec.status ? 'in' : 'out'}`}>
                                                        {rec.status ? 'In Stock' : 'Out of Stock'}
                                                    </p>
                                                    <a href={rec.url} target="_blank" rel="noreferrer" className="recLink">Open Rozetka</a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        className={`loadMoreBtn ${!hasMore ? 'no-more' : ''}`} 
                                        onClick={() => loadMore(activeRecId)} 
                                        disabled={isLoadMore || !hasMore}
                                    >
                                        {isLoadMore ? (
                                            <p>Loading...</p>
                                        ) : (
                                            hasMore ? 'Load more items' : 'No more items found'
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}