
export const startTimer = (timerRef, callback) => {
  if (timerRef.current) clearInterval(timerRef.current);
  timerRef.current = setInterval(callback, 1000);
};

export const clearTimer = (timerRef) => {
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
};
