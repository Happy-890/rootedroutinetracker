import { render, screen, act, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RootedProvider, useRooted } from "@/lib/rooted/store";
import { CloudRepo } from "@/lib/rooted/repo";
import { emptyData } from "@/lib/rooted/logic";

const auth = vi.hoisted(()=>({listener: null as null | ((e:string,s:unknown)=>void)}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{auth:{
  onAuthStateChange:(fn:typeof auth.listener)=>{auth.listener=fn;return {data:{subscription:{unsubscribe(){}}}}},
  getUser:()=>new Promise(()=>{})
}}}));
vi.mock("@/lib/rooted/push-client",()=>({reconcileDeviceAccount:async()=>{},unsubscribeDeviceLocally:async()=>{}}));
function Probe(){const r=useRooted();return <p>{r.mode}:{r.data.profile.display_name}:{String(r.dataReady)}</p>}
it("uses only a matching greeting and preserves loaded data on repeated sign-in",async()=>{
  localStorage.setItem("rooted:last-greeting",JSON.stringify(["a","Cached"]));
  let finish!: (v:ReturnType<typeof emptyData>)=>void;
  const read=vi.spyOn(CloudRepo.prototype,"load").mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
  const ui=render(<RootedProvider><Probe/></RootedProvider>);
  const session=async(id:string)=>act(async()=>{auth.listener!("SIGNED_IN",{user:{id}})});
  try {
    await session("a"); expect(screen.getByText("account:Cached:false")).toBeTruthy();
    const d=emptyData();d.profile.display_name="Confirmed";
    await act(async()=>finish(d)); await session("a");
    expect(screen.getByText("account:Confirmed:true")).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledWith(false);
    await session("b");expect(screen.getByText("account::false")).toBeTruthy();
    await act(async()=>auth.listener!("SIGNED_OUT",null));
    await waitFor(()=>expect(localStorage.getItem("rooted:last-greeting")).toBeNull());
  } finally {ui.unmount();read.mockRestore()}
});
