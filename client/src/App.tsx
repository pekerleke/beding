import Chat from './components/chat/Chat';

import styles from './App.module.scss';

function App() {
    return (
        <main>
            <div className={styles.title}>
                <h1 style={{ margin: 0 }}>🤖 Chat con contexto vectorial</h1>
                <small>OpenAi Embeddings + OpenAi api + Weaviate</small>
            </div>
            <Chat />
        </main>
    );
}

export default App; 