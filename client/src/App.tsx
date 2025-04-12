import AssistantChat from './components/assistants/AssistantChat';
import { ThemeProvider } from './components/theme/ThemeContext';
import ThemeToggle from './components/theme/ThemeToggle';

import styles from './App.module.scss';

function App() {
    return (
        <ThemeProvider>
            <main className={styles.mainContainer}>
                <div className={styles.title}>
                    <h1 style={{ margin: 0 }}>🤖 Beding</h1>
                    <small>OpenAi Embeddings + OpenAi api + Weaviate</small>
                </div>
                <AssistantChat />
                <ThemeToggle />
            </main>
        </ThemeProvider>
    );
}

export default App; 