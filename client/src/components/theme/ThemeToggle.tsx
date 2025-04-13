import React from 'react';
import { useTheme } from './ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

import styles from './theme.module.scss';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
    );
};

export default ThemeToggle; 