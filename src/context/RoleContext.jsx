import { createContext, useContext } from "react";
import { useAuth } from "./AuthContext";

const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  const { user } = useAuth();
  return (
    <RoleContext.Provider value={{ role: user?.role }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);