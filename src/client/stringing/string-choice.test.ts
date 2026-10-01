import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StringChoice } from "./string-choice";

const strings = [{id:"one",brand:"Head",name:"Velocity",gauge:"1.25"}];
it("renders catalogue options with gauge and preserves historical strings", () => {
 const html = renderToStaticMarkup(createElement(StringChoice,{strings,value:"Old custom string",onChange:()=>undefined,required:true}));
 expect(html).toContain("<select required=");
 expect(html).toContain("Head Velocity · 1.25 mm");
 expect(html).toContain('selected="">Old custom string (existing)</option>');
});
it("selects a catalogue string stored without gauge without discarding its value", () => {
 const html = renderToStaticMarkup(createElement(StringChoice,{strings,value:"Head Velocity",onChange:()=>undefined}));
 expect(html).toContain('value="Head Velocity · 1.25 mm" selected=""');
 expect(html).not.toContain("(existing)");
});
