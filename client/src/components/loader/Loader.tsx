import styles from './loader.module.scss';

export const Loader = () => {
    return (
        <div className={styles.container}>
            <div className={styles.dotsContainer}>
                <div className={styles.dot} style={{ animationDelay: '-0.3s' }}></div>
                <div className={styles.dot} style={{ animationDelay: '-0.15s' }}></div>
                <div className={styles.dot}></div>
            </div>
        </div>
    )
}
