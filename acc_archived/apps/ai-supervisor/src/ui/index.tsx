import { render } from "solid-js/web";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  render(() => <App />, root);
} else {
  console.error("[ACC AI-Supervisor UI] Failed to locate #root DOM element");
}
