import { createIcon } from './Icon.tsx';

// The rounded frame every split icon shares; each icon cuts its regions out of it.
const FRAME =
  'M224.62-160q-26.85 0-45.74-18.88Q160-197.77 160-224.62v-510.76q0-26.85 18.88-45.74Q197.77-800 224.62-800h510.76q26.85 0 45.74 18.88Q800-762.23 800-735.38v510.76q0 26.85-18.88 45.74Q762.23-160 735.38-160H224.62Z';

/** A frame with a narrow strip along its left edge. */
export const SplitLeftIcon = createIcon(
  <path
    d={`${FRAME}M320-200v-560h-95.38q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93v510.76q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69H320Zm40 0h375.38q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93v-510.76q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H360v560Z`}
  />,
  'SplitLeft'
);

/** A frame with a narrow strip along its right edge. */
export const SplitRightIcon = createIcon(
  <path
    d={`${FRAME}M640-200h120v-535.38q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H640v560Zm-40 0v-560H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93v510.76q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69H600Z`}
  />,
  'SplitRight'
);

/** A frame with a narrow strip along its top edge. */
export const SplitTopIcon = createIcon(
  <path
    d={`${FRAME}M200-640h560v-95.38q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93V-640Zm0 40v375.38q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69h510.76q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93V-600H200Z`}
  />,
  'SplitTop'
);

/** A frame with a narrow strip along its bottom edge. */
export const SplitBottomIcon = createIcon(
  <path
    d={`${FRAME}M200-320v95.38q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69h510.76q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93V-320H200Zm0-40h560v-375.38q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93V-360Z`}
  />,
  'SplitBottom'
);

/** A frame halved by a horizontal divider: one region above the other. */
export const SplitHorizontalIcon = createIcon(
  <path
    d={`${FRAME}M200-500h560v-235.38q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93V-500Zm0 40v235.38q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69h510.76q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93V-460H200Z`}
  />,
  'SplitHorizontal'
);

/** A frame holding one region that fills it. */
export const SplitFillIcon = createIcon(
  <path
    d={`${FRAME}M735.38-200q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93v-510.76q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93v510.76q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69h510.76Z`}
  />,
  'SplitFill'
);

/** A frame quartered by a cross: four regions, two by two. */
export const SplitQuartersIcon = createIcon(
  <path
    d={`${FRAME}M460-500v-260H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93V-500h260Zm300 0v-235.38q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H500v260h260ZM460-200v-260H200v235.38q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69H460Zm275.38 0q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93V-460H500v260h235.38Z`}
  />,
  'SplitQuarters'
);

/** A frame halved by a vertical divider: two regions side by side. */
export const SplitVerticalIcon = createIcon(
  <path
    d={`${FRAME}M460-200v-560H224.62q-9.24 0-16.93 7.69-7.69 7.69-7.69 16.93v510.76q0 9.24 7.69 16.93 7.69 7.69 16.93 7.69H460Zm40 0h235.38q9.24 0 16.93-7.69 7.69-7.69 7.69-16.93v-510.76q0-9.24-7.69-16.93-7.69-7.69-16.93-7.69H500v560Z`}
  />,
  'SplitVertical'
);
