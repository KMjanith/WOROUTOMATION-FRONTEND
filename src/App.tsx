import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Header from './components/Header';
import RecipeConfig from './components/RecipeConfig';
import CurrentContainersPage from './components/CurrentContainersPage';
import ImagesPage from './components/ImagesPage';
import LogsPage from './components/LogsPage';
import HConfigsPage from './components/HConfigsPage';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <div className="main-container">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<RecipeConfig />} />
              <Route path="/containers" element={<CurrentContainersPage />} />
              <Route path="/images" element={<ImagesPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/h-configs" element={<HConfigsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;