const fs = require('node:fs');

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error('No change applied to ' + path);
  fs.writeFileSync(path, after);
  console.log('updated ' + path);
}

function replaceExact(source, from, to, label) {
  if (!source.includes(from)) throw new Error('Missing target: ' + label);
  return source.replace(from, to);
}

const lines = (...items) => items.join('\n');

patch('app/admin/alerts/alerts-workspace.tsx', (source) => {
  let next = replaceExact(source, '})}</div> : {unresolved === 0 ?', '})}</div> : unresolved === 0 ?', 'alerts nested ternary start');
  next = replaceExact(next, '</OpsButton>/>}} \n        </OpsSurface>', '</OpsButton>/>} \n        </OpsSurface>', 'alerts nested ternary end');
  return next;
});

patch('app/admin/partners/partners-workspace.tsx', (source) => {
  let next = source;
  const registerStart = '      <OpsSurface eyebrow="Network register" title="Partners & vendors" description={`${filtered.length} of ${dashboard.partners.length} records shown.`} flush>';
  next = replaceExact(next, registerStart, '      {dashboard.partners.length ? <OpsSurface eyebrow="Network register" title="Partners & vendors" description={`${filtered.length} of ${dashboard.partners.length} records shown.`} flush>', 'partner register start');
  next = replaceExact(next, '      </OpsSurface>\n    </div>\n  </OpsPage>;', '      </OpsSurface> : null}\n    </div>\n  </OpsPage>;', 'partner register end');
  return next;
});

patch('app/admin/jobs/[reference]/workflow-spine.tsx', (source) => {
  const oldStages = lines(
    '      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">',
    '        {workflow.stages.map((stage, index) => <div key={stage.id} className={`rounded-[12px] border p-3 ${stageTone(stage.state)}`}>',
    '          <div className="flex items-center justify-between gap-2"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20">{stageIcon(stage.state)}</span><span className="text-[8px] font-bold tabular-nums opacity-55">{String(index + 1).padStart(2, "0")}</span></div>',
    '          <p className="mt-2 text-[9px] font-bold uppercase tracking-[.06em]">{stage.label}</p>',
    '          <p className="mt-1.5 text-[8px] leading-4 opacity-80">{stage.detail}</p>',
    '        </div>)}',
    '      </div>',
    '      <div className="mt-3"><OpsProgress value={stagePercent}/></div>'
  );
  const newStages = lines(
    '      <div className="overflow-x-auto pb-1">',
    '        <div className="flex min-w-[820px] items-start">',
    '          {workflow.stages.map((stage, index) => <div key={stage.id} className="relative min-w-0 flex-1 px-1">',
    '            {index < workflow.stages.length - 1 ? <span className={`absolute left-[calc(50%+13px)] right-[calc(-50%+13px)] top-[13px] h-[2px] ${stage.state === "complete" ? "bg-[#a9c7b2]" : "bg-[#ddd8d2]"}`} aria-hidden="true"/> : null}',
    '            <div className="relative z-10 flex flex-col items-center text-center">',
    '              <span className={`inline-flex h-[27px] w-[27px] items-center justify-center rounded-full border bg-white ${stageTone(stage.state)}`}>{stageIcon(stage.state)}</span>',
    '              <span className="mt-2 text-[10px] font-bold text-[#49433e]">{stage.label}</span>',
    '              <span className="mt-1 max-w-[120px] text-[8px] leading-4 text-[#817a73]">{stage.detail}</span>',
    '            </div>',
    '          </div>)}',
    '        </div>',
    '      </div>',
    '      <div className="mt-4"><OpsProgress value={stagePercent}/></div>'
  );
  return replaceExact(source, oldStages, newStages, 'job workflow journey');
});

patch('app/admin/jobs/[reference]/page.tsx', (source) => {
  let next = source;
  next = replaceExact(next, 'className="rounded-[10px] border border-[#e5ddd6] bg-[#fffdfa] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#5b514a] shadow-lg"', 'className="ops-button shadow-[0_8px_28px_rgba(54,43,34,.10)]" data-variant="secondary" data-size="sm"', 'job profitability action');
  next = replaceExact(next, 'className="rounded-[10px] border border-[#d4dfd5] bg-[#f3f8f3] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#5e7462] shadow-lg"', 'className="ops-button shadow-[0_8px_28px_rgba(54,43,34,.10)]" data-variant="primary" data-size="sm"', 'job invoice action');
  next = replaceExact(next, 'className="rounded-[10px] border border-[#eadcc4] bg-[#fff9ee] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#8a6836] shadow-lg"', 'className="ops-button border-[#ead5b1] bg-[#fff8ec] text-[#8d5d22] shadow-[0_8px_28px_rgba(54,43,34,.08)]" data-variant="secondary" data-size="sm"', 'job payable action');
  return next;
});
