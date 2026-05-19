import { createContext, useContext } from "react";

const ReadOnlyContext = createContext(false);

export const ReadOnlyProvider = ReadOnlyContext.Provider;

// eslint-disable-next-line react-refresh/only-export-components
export const useReadOnly = () => useContext(ReadOnlyContext);
