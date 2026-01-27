import './App.css'
import AdminInput from './components/AdminInput/AdminInput'
import ListOfGoods from './components/ListOfGoods/ListOfGoods'
import Header from './components/Header/Header';
import React from 'react';

function App() {
  const [refreshGoods, setRefreshGoods] = React.useState(0);

  const refresh = () => setRefreshGoods(refreshGoods + 1);
  return (
    <>
    <div className="wrap">
    <Header />
    <AdminInput onAddGood={refresh} />
    <ListOfGoods refreshGoods={refreshGoods} />
    </div>
    </>
  )
}

export default App