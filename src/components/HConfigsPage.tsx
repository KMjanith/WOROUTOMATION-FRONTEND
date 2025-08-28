import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './HConfigsPage.css';

const HConfigsPage: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Terminal initialization and WebSocket connection
  useEffect(() => {
    // Guard clause to ensure terminalRef.current exists and terminal isn't already initialized
    if (!terminalRef.current || terminalInstance.current) return;

    const initTerminal = () => {
      // Safe to use terminalRef.current here since we've checked it's not null above
      const terminalElement = terminalRef.current;
      
      const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        theme: {
          background: '#1a1a1a',
          foreground: '#f8f8f8',
          cursor: '#ffffff'
        },
        convertEol: true,
        rows: 24,
        cols: 80
      });

      terminalInstance.current = term;
      
      // Type assertion to tell TypeScript that terminalElement is non-null
      term.open(terminalElement as HTMLElement);

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      fitAddonInstance.current = fitAddon;
      
      // Use a short delay or an animation frame request to ensure rendering has completed
      setTimeout(() => {
        try {
          fitAddon.fit();
          setIsTerminalReady(true);
          term.focus(); // Focus after fitting
        } catch (err) {
          console.error("Error fitting terminal:", err);
        }
      }, 100); // A short, non-blocking delay is usually sufficient

      return term;
    };

    const connectWebSocket = (term: Terminal) => {
      setConnectionState('connecting');
      setErrorMessage(null);
      
      try {
        // Close any existing connection
        if (socketRef.current) {
          socketRef.current.close();
        }

        term.writeln('Connecting to terminal server...');
        
        // Create WebSocket connection
        const socket = new WebSocket('ws://localhost:3001/terminal');
        socketRef.current = socket;

        socket.onopen = () => {
          setConnectionState('connected');
          term.clear();
          term.writeln('Connected to terminal server');
          term.writeln('');
        };

        socket.onmessage = (event) => {
          term.write(event.data);
        };

        socket.onclose = (event) => {
          setConnectionState('disconnected');
          term.writeln('\r\n\r\nConnection closed');
          if (event.code !== 1000) {
            term.writeln(`Close code: ${event.code}`);
            term.writeln('\r\nClick "Reconnect" to try again');
          }
        };

        socket.onerror = () => {
          setConnectionState('disconnected');
          const errorMsg = 'WebSocket connection error';
          setErrorMessage(errorMsg);
          term.writeln(`\r\n\r\n${errorMsg}`);
        };

        // Send terminal input to server
        term.onData(data => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(data);
          }
        });
      } catch (error) {
        setConnectionState('disconnected');
        const errorMsg = `Failed to connect: ${(error as Error).message}`;
        setErrorMessage(errorMsg);
        term.writeln(errorMsg);
      }
    };

    const term = initTerminal();
    
    // Connect after terminal is initialized
    setTimeout(() => {
      if (term) {
        connectWebSocket(term);
      }
    }, 300);

    // Handle window resize
    const handleResize = () => {
      if (fitAddonInstance.current) {
        try {
          fitAddonInstance.current.fit();
        } catch (err) {
          console.error("Error during resize:", err);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
    };
  }, []);

  // Try to reconnect
  const handleReconnect = () => {
    if (terminalInstance.current) {
      connectWebSocket(terminalInstance.current);
    }
  };

  // Connect to WebSocket
  const connectWebSocket = (term: Terminal) => {
    setConnectionState('connecting');
    setErrorMessage(null);
    
    try {
      // Close any existing connection
      if (socketRef.current) {
        socketRef.current.close();
      }

      term.writeln('Connecting to terminal server...');
      
      // Create WebSocket connection
      const socket = new WebSocket('ws://localhost:3001/terminal');
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionState('connected');
        term.clear();
        term.writeln('Connected to terminal server');
        term.writeln('');
      };

      socket.onmessage = (event) => {
        term.write(event.data);
      };

      socket.onclose = (event) => {
        setConnectionState('disconnected');
        term.writeln('\r\n\r\nConnection closed');
        if (event.code !== 1000) {
          term.writeln(`Close code: ${event.code}`);
          term.writeln('\r\nClick "Reconnect" to try again');
        }
      };

      socket.onerror = () => {
        setConnectionState('disconnected');
        const errorMsg = 'WebSocket connection error';
        setErrorMessage(errorMsg);
        term.writeln(`\r\n\r\n${errorMsg}`);
      };

      // Send terminal input to server
      term.onData(data => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });
    } catch (error) {
      setConnectionState('disconnected');
      const errorMsg = `Failed to connect: ${(error as Error).message}`;
      setErrorMessage(errorMsg);
      term.writeln(errorMsg);
    }
  };

  // Focus terminal
  const focusTerminal = () => {
    if (terminalInstance.current) {
      terminalInstance.current.focus();
    }
  };

  return (
    <div className="h-configs-page">
      <div className="terminal-header">
        <h2>Terminal</h2>
        <div className="connection-status">
          {connectionState === 'connected' && (
            <span className="status-connected">Connected</span>
          )}
          {connectionState === 'connecting' && (
            <span className="status-connecting">Connecting...</span>
          )}
          {connectionState === 'disconnected' && (
            <>
              <span className="status-disconnected">Disconnected</span>
              {errorMessage && <span className="error-tooltip" title={errorMessage}>⚠️</span>}
            </>
          )}
          {connectionState === 'disconnected' && (
            <button 
              className="reconnect-btn" 
              onClick={handleReconnect}
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
      <div 
        className="terminal-container" 
        ref={terminalRef} 
        onClick={focusTerminal}
      >
        {!isTerminalReady && (
          <div className="terminal-loading">
            <div className="spinner"></div>
            <p>Initializing terminal...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HConfigsPage;