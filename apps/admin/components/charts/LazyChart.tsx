"use client";
import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { Skeleton } from "@zeal/ui";
const Inner = dynamic(() => import("recharts").then((m) => {
  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } = m;
  function C(p: { data: Array<Record<string, unknown>>; xKey: string; yKey: string; color: string }) {
    return (<ResponsiveContainer width="100%" height="100%"><LineChart data={p.data}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/><XAxis dataKey={p.xKey} stroke="var(--color-muted-foreground)" fontSize={11}/><YAxis stroke="var(--color-muted-foreground)" fontSize={11}/><Tooltip contentStyle={{background:"var(--color-surface-overlay)",border:"1px solid var(--color-border)",borderRadius:"12px",color:"var(--color-foreground)"}}/><Line type="monotone" dataKey={p.yKey} stroke={p.color} strokeWidth={2} dot={{fill:p.color,r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer>);
  }
  return { default: C };
}), { ssr: false, loading: () => <Skeleton className="w-full h-full" /> });
export function LazyChart({ data, xKey, yKey, color, heightClass = "h-72" }: { data: Array<Record<string, unknown>>; xKey: string; yKey: string; color: string; heightClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setV(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={heightClass}>{v ? <Inner data={data} xKey={xKey} yKey={yKey} color={color} /> : <Skeleton className="w-full h-full" />}</div>;
}
