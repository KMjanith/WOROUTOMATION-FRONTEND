import './App.css'
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar'
import Header from './components/Header'
import RecipeConfig from './components/RecipeConfig'
import CurrentContainersPage from './components/CurrentContainersPage'
import ImagesPage from './components/ImagesPage'
import LogsPage from './components/LogsPage'
import HConfigsPage from './components/HConfigsPage';

function App() {
  const [page, setPage] = useState(window.location.hash || '#home');

  // Listen for hash changes
  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash || '#home');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  let content;
  if (page === '#containers') {
    content = <CurrentContainersPage />;
  } else if (page === '#images') {
    content = <ImagesPage />;
  } else if (page === '#logs') {
    content = <LogsPage />;
  } else if (page === '#h-configs') {
    content = <HConfigsPage />;
  } else {
    content = <RecipeConfig />;
  }

  return (
    <div className="App">
      <Navbar />
      <div className="main-container">
        <Header />
        <main className="main-content">
          {content}
        </main>
      </div>
    </div>
  )
}

export default App
