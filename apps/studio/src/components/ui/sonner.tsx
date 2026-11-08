import { Toaster as Sonner, toast } from "solid-sonner";
import { CircleCheck, Info, TriangleAlert, OctagonX, Loader2 } from "lucide-solid";
import { useTheme } from "../../lib/theme/ThemeProvider";

export interface ToasterProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  richColors?: boolean;
  expand?: boolean;
  duration?: number;
  gap?: number;
  [key: string]: any;
}

const Toaster = (props: ToasterProps) => {
  let themeMode = "dark";
  try {
    const theme = useTheme();
    themeMode = theme.preferences.mode;
  } catch {
    // fallback
  }

  return (
    <Sonner
      theme={themeMode as any}
      class="toaster group"
      icons={{
        success: <CircleCheck class="size-4" />,
        info: <Info class="size-4" />,
        warning: <TriangleAlert class="size-4" />,
        error: <OctagonX class="size-4" />,
        loading: <Loader2 class="size-4 animate-spin" />,
      }}
      toastOptions={{
        classes: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
