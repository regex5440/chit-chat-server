function debounce(delay) {
  let timer = null;
  return (func) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(() => {
      func();
    }, delay);
  };
}

module.exports = { debounce };
