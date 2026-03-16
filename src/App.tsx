import { useState } from 'react';
import LearnerMode from './components/LearnerMode';
import AdminMode from './components/AdminMode';

const isAdminBuild = import.meta.env.VITE_ADMIN_MODE === 'true';

function App() {
  const [mode, setMode] = useState<'learner' | 'admin'>('learner');

  return (
    <div className={mode === 'learner' ? "container" : "admin-container"}>
      <header>
        <h1>문장 학습</h1>
        <div className="nav-links">
          {isAdminBuild && (
            mode === 'learner' ? (
              <button onClick={() => setMode('admin')} style={{ padding: '10px 20px', fontSize: '15px' }}>
                관리자 모드로 가기
              </button>
            ) : (
              <button onClick={() => setMode('learner')} style={{ padding: '10px 20px', fontSize: '15px' }}>
                학습 모드로 가기
              </button>
            )
          )}
        </div>
      </header>

      {isAdminBuild && mode === 'admin' ? <AdminMode /> : <LearnerMode />}
    </div>
  );
}

export default App;
