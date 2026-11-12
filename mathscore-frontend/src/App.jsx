import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminApp from './admin/App.jsx';
import StudentApp from './student/App.jsx';

import './admin/App.css';
import './student/App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/student/*" element={<StudentApp />} />
        <Route path="/*" element={<StudentApp />} />
      </Routes>
    </Router>
  );
}

export default App;

