import React, { useEffect, useRef, useState } from 'react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  /** Id of the input, so a page-level `<label htmlFor>` can name it. */
  id?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  id,
}) => {
  const [inputValue, setInputValue] = useState(value);

  // The parent typically passes an inline callback (`setFilter.bind(null, "query")`),
  // so its identity changes on every render. Holding it in a ref stops the
  // notification effect below from restarting — and, more importantly, from
  // re-firing — on every render, which previously caused an infinite
  // setState/render loop ("Maximum update depth exceeded").
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // The last value we reported upwards, so the parent echoing it back through
  // `value` is not mistaken for a fresh edit.
  const lastEmittedRef = useRef(value);

  // Adopt externally-driven changes (URL state, "clear filters", …) without
  // fighting whatever the user is currently typing.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setInputValue(value);
  }, [value]);

  // Debounce upward notifications, and only notify on a real change.
  useEffect(() => {
    if (inputValue === lastEmittedRef.current) return;
    const handler = setTimeout(() => {
      lastEmittedRef.current = inputValue;
      onChangeRef.current(inputValue);
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [inputValue, debounceMs]);

  return (
    <input
      type="text"
      id={id}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      className={styles.input}
    />
  );
};