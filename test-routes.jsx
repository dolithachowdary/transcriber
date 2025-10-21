import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

const Home = () => (
  <div>
    <h1>Home Page</h1>
    <Link to="/meeting">Go to Meeting</Link>
  </div>
);

const Meeting = () => (
  <div>
    <h1>Meeting Page</h1>
    <Link to="/">Go Home</Link>
  </div>
);

const TestApp = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/meeting" element={<Meeting />} />
    </Routes>
  </BrowserRouter>
);

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<TestApp />);
