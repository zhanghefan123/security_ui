import React, {useLayoutEffect, useRef} from "react";
import {createPortal} from "react-dom";
import {createConstellationContextMenu, getContextMenuAction} from "../entities/topology_context_menu";

// Reuse the topology menu markup; Cesium supplies the picked entity and screen position.
export function ConstellationContextMenu({menu, onAction, onClose}) {
    const hostRef = useRef(null);
    const callbacksRef = useRef({onAction, onClose});
    callbacksRef.current = {onAction, onClose};

    useLayoutEffect(() => {
        if (!menu || !hostRef.current) return;
        const host = hostRef.current;
        host.replaceChildren(createConstellationContextMenu(menu));
        const bounds = host.getBoundingClientRect();
        host.style.left = `${Math.max(12, Math.min(menu.x, window.innerWidth - bounds.width - 12))}px`;
        host.style.top = `${Math.max(12, Math.min(menu.y, window.innerHeight - bounds.height - 12))}px`;
        const click = (event) => {
            const action = getContextMenuAction(event.target);
            if (action) callbacksRef.current.onAction(action, menu);
        };
        const outside = (event) => {
            if (!host.contains(event.target)) callbacksRef.current.onClose();
        };
        const escape = (event) => {
            if (event.key === "Escape") callbacksRef.current.onClose();
        };
        const scroll = (event) => {
            if (!(event.target instanceof Node) || !host.contains(event.target)) callbacksRef.current.onClose();
        };
        const close = () => callbacksRef.current.onClose();
        const context = (event) => event.preventDefault();
        host.addEventListener("click", click);
        host.addEventListener("contextmenu", context);
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        window.addEventListener("resize", close);
        window.addEventListener("scroll", scroll, true);
        return () => {
            host.removeEventListener("click", click);
            host.removeEventListener("contextmenu", context);
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape);
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", scroll, true);
        };
    }, [menu]);

    if (!menu) return null;
    return createPortal(<div ref={hostRef} className="topology-context-menu"
        role="region" aria-label={`${menu.name} 右键菜单`}
        style={{position: "fixed", left: menu.x, top: menu.y}}/>, document.body);
}
