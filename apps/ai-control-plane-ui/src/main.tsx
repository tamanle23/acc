import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./App";
import { ThemeProvider } from "@/components/studio/theme-manager";
import "./index.css";

const root = document.getElementById("root");
if (root) {
  render(
    () => (
      <ThemeProvider>
        <Router>
          <Route path={["/", "/*all"]} component={App} />
        </Router>
      </ThemeProvider>
    ),
    root
  );
}
