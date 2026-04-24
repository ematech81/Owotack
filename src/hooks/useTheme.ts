import { useColorScheme } from "react-native";
import { lightColors, darkColors, AppColors } from "../constants/colors";

export function useTheme(): AppColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
