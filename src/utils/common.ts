function debounce(delay: number) {
  let timer: null | number = null;
  return (func: (...args: any) => any) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(() => {
      func();
    }, delay) as unknown as number;
  };
}

export { debounce };
