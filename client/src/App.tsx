import AssistantChat from './components/assistants/AssistantChat';
import { ThemeProvider } from './components/theme/ThemeContext';

import styles from './App.module.scss';

function App() {
    return (
        <ThemeProvider>
            <main className={styles.mainContainer}>
                <AssistantChat />
            </main>
        </ThemeProvider>
    );
}

export default App; 