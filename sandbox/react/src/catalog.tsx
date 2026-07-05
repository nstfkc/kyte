import type { ComponentType } from "react";
import type { Catalog } from "@kyte/react";
import { catalogSchemas } from "./catalog-manifest";

import * as accordion from "@/components/ui/accordion";
import * as alert from "@/components/ui/alert";
import * as alert_dialog from "@/components/ui/alert-dialog";
import * as aspect_ratio from "@/components/ui/aspect-ratio";
import * as attachment from "@/components/ui/attachment";
import * as avatar from "@/components/ui/avatar";
import * as badge from "@/components/ui/badge";
import * as breadcrumb from "@/components/ui/breadcrumb";
import * as bubble from "@/components/ui/bubble";
import * as button from "@/components/ui/button";
import * as button_group from "@/components/ui/button-group";
import * as calendar from "@/components/ui/calendar";
import * as card from "@/components/ui/card";
import * as carousel from "@/components/ui/carousel";
import * as chart from "@/components/ui/chart";
import * as checkbox from "@/components/ui/checkbox";
import * as collapsible from "@/components/ui/collapsible";
import * as combobox from "@/components/ui/combobox";
import * as command from "@/components/ui/command";
import * as context_menu from "@/components/ui/context-menu";
import * as dialog from "@/components/ui/dialog";
import * as direction from "@/components/ui/direction";
import * as drawer from "@/components/ui/drawer";
import * as dropdown_menu from "@/components/ui/dropdown-menu";
import * as empty from "@/components/ui/empty";
import * as field from "@/components/ui/field";
import * as form from "@/components/ui/form";
import * as hover_card from "@/components/ui/hover-card";
import * as input from "@/components/ui/input";
import * as input_group from "@/components/ui/input-group";
import * as input_otp from "@/components/ui/input-otp";
import * as item from "@/components/ui/item";
import * as kbd from "@/components/ui/kbd";
import * as label from "@/components/ui/label";
import * as marker from "@/components/ui/marker";
import * as menubar from "@/components/ui/menubar";
import * as message from "@/components/ui/message";
import * as message_scroller from "@/components/ui/message-scroller";
import * as native_select from "@/components/ui/native-select";
import * as navigation_menu from "@/components/ui/navigation-menu";
import * as pagination from "@/components/ui/pagination";
import * as popover from "@/components/ui/popover";
import * as progress from "@/components/ui/progress";
import * as radio_group from "@/components/ui/radio-group";
import * as resizable from "@/components/ui/resizable";
import * as scroll_area from "@/components/ui/scroll-area";
import * as select from "@/components/ui/select";
import * as separator from "@/components/ui/separator";
import * as sheet from "@/components/ui/sheet";
import * as sidebar from "@/components/ui/sidebar";
import * as skeleton from "@/components/ui/skeleton";
import * as slider from "@/components/ui/slider";
import * as sonner from "@/components/ui/sonner";
import * as spinner from "@/components/ui/spinner";
import * as switchModule from "@/components/ui/switch";
import * as table from "@/components/ui/table";
import * as tabs from "@/components/ui/tabs";
import * as textarea from "@/components/ui/textarea";
import * as toggle from "@/components/ui/toggle";
import * as toggle_group from "@/components/ui/toggle-group";
import * as tooltip from "@/components/ui/tooltip";

// Every installed shadcn/ui module, keyed by family (used both to register
// components and to describe the catalog to the LLM).
const modules: Record<string, Record<string, unknown>> = {
  accordion,
  alert,
  "alert-dialog": alert_dialog,
  "aspect-ratio": aspect_ratio,
  attachment,
  avatar,
  badge,
  breadcrumb,
  bubble,
  button,
  "button-group": button_group,
  calendar,
  card,
  carousel,
  chart,
  checkbox,
  collapsible,
  combobox,
  command,
  "context-menu": context_menu,
  dialog,
  direction,
  drawer,
  "dropdown-menu": dropdown_menu,
  empty,
  field,
  form,
  "hover-card": hover_card,
  input,
  "input-group": input_group,
  "input-otp": input_otp,
  item,
  kbd,
  label,
  marker,
  menubar,
  message,
  "message-scroller": message_scroller,
  "native-select": native_select,
  "navigation-menu": navigation_menu,
  pagination,
  popover,
  progress,
  "radio-group": radio_group,
  resizable,
  "scroll-area": scroll_area,
  select,
  separator,
  sheet,
  sidebar,
  skeleton,
  slider,
  sonner,
  spinner,
  switch: switchModule,
  table,
  tabs,
  textarea,
  toggle,
  "toggle-group": toggle_group,
  tooltip,
};

function isComponent(value: unknown): value is ComponentType<any> {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value)
  );
}

// Register every exported React component from every shadcn/ui module, attaching
// curated prop schemas where we have them.
function buildCatalog(): Catalog {
  const catalog: Catalog = {};
  for (const mod of Object.values(modules)) {
    for (const [name, value] of Object.entries(mod)) {
      if (/^[A-Z]/.test(name) && isComponent(value)) {
        catalog[name] = { component: value, ...catalogSchemas[name] };
      }
    }
  }
  return catalog;
}

export const catalog = buildCatalog();
