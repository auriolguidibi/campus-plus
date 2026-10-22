import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import { DataModeProvider } from './dataMode'
import { ThemeProvider } from './theme'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <DataModeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </DataModeProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
