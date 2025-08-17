import './App.css'
import Navbar from './components/Navbar'
import Header from './components/Header'
import SidePanel from './components/SidePanel'
import RecipeConfig from './components/RecipeConfig'

function App() {
  return (
    <div className="App">
      <Navbar />
      <SidePanel />
      <div className="main-container">
        <Header />
        
        <main className="main-content">
          <RecipeConfig />
        </main>
      </div>
    </div>
  )
}

export default App
