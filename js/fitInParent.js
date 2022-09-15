const log = console.log;

function fitInParent(child, obj = {}) {

    const parent = obj.parent ?? child.parentElement;
    const maxWidth = obj.maxWidthFill ?? 0.9;
    const maxHeight = obj.maxHeightFill ?? 0.9;
    const doNotMagnify = obj.doNotMagnify ?? true;
    const transforms = obj.transforms ?? "";

    if (obj.drawBorder) parent.style.border = "2px solid blue";
    if (obj.drawBorder) child.style.border = "2px solid red";

    const resize = () => {

        const widthDifference = (parent.offsetWidth / child.offsetWidth) * maxWidth;
        const heightDifference = (parent.offsetHeight / child.offsetHeight) * maxHeight;

        let scale = Math.min(widthDifference, heightDifference);
        if (doNotMagnify) scale = Math.min(scale, 1);
        child.style.transform = `${transforms} scale(${scale})`;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("touch", () => {
        alert();
        resize();
    });
    resize();
}


export { fitInParent };
