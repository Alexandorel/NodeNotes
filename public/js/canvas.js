(function () {
    const fileId = window.__FILE_ID__;
    const fileNameInput = document.getElementById('file-name');
    const saveStatus = document.getElementById('save-status');
    const sidePanel = document.getElementById('side-panel');
    const edgeHint = document.getElementById('edge-hint');
    const cyEl = document.getElementById('cy');

    let saveTimer = null;
    let dirty = false;
    let pendingEdgeSource = null;
    let resizeEls = [];
    let resizingData = null;
    let activeNoteNode = null;

    function computeFontSize(w, h) {
        return Math.max(8, Math.round(Math.min(w, h) / 6));
    }

    function nextId(prefix) {
        return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
    }

    if (typeof cytoscape === 'undefined') {
        saveStatus.textContent = 'Cytoscape failed to load';
        console.error('Cytoscape lib missing');
        return;
    }

    const cy = cytoscape({
        container: cyEl,
        wheelSensitivity: 0.2,
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#ffffff',
                    'label': 'data(label)',
                    'color': '#000',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': 'data(fontSize)',
                    'text-wrap': 'wrap',
                    'text-max-width': 'data(w)',
                    'width': 'data(w)',
                    'height': 'data(h)',
                    'border-width': 2,
                    'border-color': '#000'
                }
            },
            { selector: 'node:selected', style: { 'border-width': 2, 'border-color': '#000' } },
            { selector: 'node[hasNote = "true"]', style: { 'background-color': '#fffde7', 'border-color': '#000' } },
            { selector: 'node.edge-source', style: { 'border-color': '#000', 'border-width': 4, 'border-style': 'dashed' } },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#000',
                    'target-arrow-color': '#000',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            },
            { selector: 'edge:selected', style: { 'line-color': '#555', 'target-arrow-color': '#555', 'width': 3 } }
        ]
    });

    // ── Resize handles ────────────────────────────────────────────

    function removeResizeEls() {
        resizeEls.forEach(el => el.remove());
        resizeEls = [];
    }

    function placeResizeHandles(node) {
        removeResizeEls();
        const rp = node.renderedPosition();
        const rw = node.renderedWidth();
        const rh = node.renderedHeight();
        const S = 10;

        const box = document.createElement('div');
        box.className = 'resize-box';
        box.style.left   = (rp.x - rw / 2) + 'px';
        box.style.top    = (rp.y - rh / 2) + 'px';
        box.style.width  = rw + 'px';
        box.style.height = rh + 'px';
        cyEl.appendChild(box);
        resizeEls.push(box);

        [
            { id: 'nw', lx: -0.5, ly: -0.5 },
            { id: 'ne', lx:  0.5, ly: -0.5 },
            { id: 'sw', lx: -0.5, ly:  0.5 },
            { id: 'se', lx:  0.5, ly:  0.5 },
        ].forEach(({ id, lx, ly }) => {
            const h = document.createElement('div');
            h.className = 'resize-handle resize-' + id;
            h.style.left = (rp.x + lx * rw - S / 2) + 'px';
            h.style.top  = (rp.y + ly * rh - S / 2) + 'px';
            cyEl.appendChild(h);
            resizeEls.push(h);

            h.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                resizingData = {
                    node, id,
                    startX: e.clientX,
                    startY: e.clientY,
                    startW: node.data('w') || 80,
                    startH: node.data('h') || 80,
                };
            });
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (!resizingData) return;
        const { node, id, startX, startY, startW, startH } = resizingData;
        const zoom = cy.zoom();
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        let newW = startW;
        let newH = startH;
        if (id.includes('e')) newW = Math.max(40, Math.round(startW + dx * 2));
        if (id.includes('w')) newW = Math.max(40, Math.round(startW - dx * 2));
        if (id.includes('s')) newH = Math.max(40, Math.round(startH + dy * 2));
        if (id.includes('n')) newH = Math.max(40, Math.round(startH - dy * 2));
        node.data('w', newW);
        node.data('h', newH);
        node.data('fontSize', computeFontSize(newW, newH));
        placeResizeHandles(node);
        markDirty();
    });

    document.addEventListener('mouseup', () => {
        resizingData = null;
    });

    // ─────────────────────────────────────────────────────────────

    function clearEdgeSource() {
        if (pendingEdgeSource) {
            pendingEdgeSource.removeClass('edge-source');
            pendingEdgeSource = null;
        }
        edgeHint.style.display = 'none';
    }

    function setEdgeSource(node) {
        clearEdgeSource();
        pendingEdgeSource = node;
        node.addClass('edge-source');
        edgeHint.style.display = 'inline';
        edgeHint.textContent = 'Shift+click another node to connect (Esc to cancel)';
    }

    function loadGraph(data) {
        fileNameInput.value = data.name || '';
        const nodes = (data.nodes || []).map(n => ({
            group: 'nodes',
            data: { id: n.nodeId, label: n.label, note: n.note || '', hasNote: n.note ? 'true' : 'false', w: n.w || 80, h: n.h || 80, fontSize: n.fontSize || computeFontSize(n.w || 80, n.h || 80) },
            position: { x: n.x || 0, y: n.y || 0 }
        }));
        const edges = (data.edges || []).map(e => ({
            group: 'edges',
            data: { id: e.edgeId, edgeId: e.edgeId, source: e.source, target: e.target }
        }));
        cy.elements().remove();
        cy.add([...nodes, ...edges]);
        if (nodes.length > 0) cy.fit(undefined, 50);
        renderSidePanel();
    }

    function serializeGraph() {
        return {
            name: fileNameInput.value.trim() || 'Untitled file',
            nodes: cy.nodes().map(n => ({
                nodeId: n.id(),
                label: n.data('label') || 'New node',
                note: n.data('note') || '',
                x: n.position('x'),
                y: n.position('y'),
                w: n.data('w') || 80,
                h: n.data('h') || 80,
                fontSize: n.data('fontSize') || computeFontSize(n.data('w') || 80, n.data('h') || 80)
            })),
            edges: cy.edges().map(e => ({
                edgeId: e.id(),
                source: e.data('source'),
                target: e.data('target')
            }))
        };
    }

    function markDirty() {
        dirty = true;
        saveStatus.textContent = 'Unsaved...';
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 800);
    }

    async function saveNow() {
        if (!dirty) return;
        dirty = false;
        saveStatus.textContent = 'Saving...';
        try {
            const res = await fetch('/api/files/' + fileId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serializeGraph())
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            saveStatus.textContent = 'Saved';
        } catch (err) {
            console.error(err);
            saveStatus.textContent = 'Save error';
            dirty = true;
        }
    }

    function addNodeAt(pos, label) {
        const id = nextId('n');
        const ele = cy.add({
            group: 'nodes',
            data: { id, label: label || 'New node', note: '', hasNote: 'false', w: 80, h: 80, fontSize: computeFontSize(80, 80) },
            position: pos
        });
        markDirty();
        return ele;
    }

    function connectNodes(source, target) {
        if (!source || !target || source.same(target)) return;
        const existing = cy.edges().filter(e =>
            e.data('source') === source.id() && e.data('target') === target.id()
        );
        if (existing.length > 0) return;
        const id = nextId('e');
        cy.add({
            group: 'edges',
            data: { id, edgeId: id, source: source.id(), target: target.id() }
        });
        markDirty();
    }

    function renderSidePanel() {
        const selected = cy.$('node:selected, edge:selected');

        if (selected.length === 0) {
            removeResizeEls();
            sidePanel.innerHTML = `
                <h3>Details</h3>
                <p class="empty">Select a node to edit its label and note.</p>
                <div class="hint">
                    <strong>How to use:</strong><br>
                    - Double-click on canvas: new node<br>
                    - <em>+ Node</em> button: new node at center<br>
                    - <strong>Shift+click</strong> a node, then another: connect<br>
                    - Double-click a node: quick rename<br>
                    - Select + <em>Delete</em> key: remove<br>
                    - Drag a corner handle to resize<br>
                    - Scroll: zoom &nbsp;/&nbsp; drag background: pan<br>
                    - <em>Esc</em>: cancel connection mode
                </div>`;
            return;
        }

        if (selected.length > 1) {
            removeResizeEls();
            sidePanel.innerHTML = `<h3>Details</h3><p class="empty">${selected.length} elements selected.</p>`;
            return;
        }

        const el = selected[0];

        if (el.isNode()) {
            placeResizeHandles(el);
            sidePanel.innerHTML = `
                <h3>Node selected</h3>
                <small>ID: ${el.id()}</small>
                <label>Label</label>
                <input id="node-label" type="text" value="${escapeAttr(el.data('label') || '')}">`;
            document.getElementById('node-label').addEventListener('input', (e) => {
                el.data('label', e.target.value);
                markDirty();
            });
        } else {
            removeResizeEls();
            sidePanel.innerHTML = `
                <h3>Connection selected</h3>
                <small>${el.data('source')} &rarr; ${el.data('target')}</small>
                <button id="del-edge" style="background:transparent;color:#dc3545;border:1.5px solid #dc3545;padding:8px;border-radius:3px;cursor:pointer;margin-top:8px;font-weight:600;width:100%;">Delete connection</button>`;
            document.getElementById('del-edge').addEventListener('click', () => {
                el.remove();
                markDirty();
                renderSidePanel();
            });
        }
    }

    function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
    function escapeText(s) { return String(s).replace(/</g, '&lt;'); }

    // ── Note modal ────────────────────────────────────────────────
    function openNoteModal(node) {
        activeNoteNode = node;
        document.getElementById('note-modal-label-input').value = node.data('label') || '';
        document.getElementById('note-modal-textarea').value = node.data('note') || '';
        document.getElementById('note-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('note-modal-label-input').focus(), 50);
    }

    function closeNoteModal() {
        document.getElementById('note-modal').style.display = 'none';
        activeNoteNode = null;
    }

    function saveNoteModal() {
        if (!activeNoteNode) return;
        const label = document.getElementById('note-modal-label-input').value;
        const note = document.getElementById('note-modal-textarea').value;
        if (label.trim()) activeNoteNode.data('label', label);
        activeNoteNode.data('note', note);
        activeNoteNode.data('hasNote', note ? 'true' : 'false');
        markDirty();
        closeNoteModal();
    }

    document.getElementById('note-modal-save').addEventListener('click', saveNoteModal);
    document.getElementById('note-modal-close').addEventListener('click', closeNoteModal);
    document.getElementById('note-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('note-modal')) closeNoteModal();
    });
    // ─────────────────────────────────────────────────────────────

    cy.on('tap', (evt) => {
        if (evt.target === cy) {
            clearEdgeSource();
            renderSidePanel();
            return;
        }
        if (evt.target.isNode && evt.target.isNode()) {
            const shift = evt.originalEvent && evt.originalEvent.shiftKey;
            if (shift) {
                if (!pendingEdgeSource) {
                    setEdgeSource(evt.target);
                } else {
                    connectNodes(pendingEdgeSource, evt.target);
                    clearEdgeSource();
                }
            } else {
                openNoteModal(evt.target);
            }
        }
    });

    cy.on('select unselect', renderSidePanel);

    cy.on('zoom pan', () => {
        const sel = cy.$('node:selected');
        if (sel.length === 1) placeResizeHandles(sel[0]);
        else removeResizeEls();
    });

    cy.on('drag', 'node', (evt) => {
        placeResizeHandles(evt.target);
    });

    cy.on('dbltap', (evt) => {
        if (evt.target === cy) {
            addNodeAt(evt.position);
        } else if (evt.target.isNode && evt.target.isNode()) {
            const node = evt.target;
            const newLabel = prompt('Rename node:', node.data('label') || '');
            if (newLabel !== null) {
                node.data('label', newLabel);
                markDirty();
                renderSidePanel();
            }
        }
    });

    cy.on('dragfree', 'node', markDirty);

    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
        if (e.key === 'Escape') {
            closeNoteModal();
            clearEdgeSource();
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
            const sel = cy.$(':selected');
            if (sel.length > 0) {
                sel.remove();
                markDirty();
                renderSidePanel();
            }
        }
    });

    fileNameInput.addEventListener('input', markDirty);

    document.getElementById('btn-add-node').addEventListener('click', () => {
        const ext = cy.extent();
        const x = (ext.x1 + ext.x2) / 2;
        const y = (ext.y1 + ext.y2) / 2;
        addNodeAt({ x, y });
    });

    document.getElementById('btn-save').addEventListener('click', saveNow);
    document.getElementById('btn-fit').addEventListener('click', () => cy.fit(undefined, 50));

    window.addEventListener('beforeunload', (e) => {
        if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    fetch('/api/files/' + fileId)
        .then(r => r.json())
        .then(loadGraph)
        .catch(err => {
            console.error(err);
            saveStatus.textContent = 'Load error';
        });
})();
