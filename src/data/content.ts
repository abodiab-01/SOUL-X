import { Project, Pillar } from '../types';

export const projectsData: Project[] = [
  {
    id: 'soulx-monolith',
    title: {
      ar: 'Soul-X Monolith',
      en: 'Soul-X Monolith'
    },
    category: {
      ar: 'أجهزة صوتية فائقة',
      en: 'Acoustic Hardware'
    },
    categoryKey: 'hardware',
    year: '2026',
    tagline: {
      ar: 'عمود صوتي أحادي منحوت من حجر الأوبسيديان المعتم',
      en: 'Sculpted monolithic acoustic column in matte obsidian'
    },
    description: {
      ar: 'قطعة فنية تجمع بين هندسة الصوت المكاني 360 درجة وجسم منحوت بدقة متناهية من الألمنيوم المؤكسد وألياف الكربون، لتجربة استماع حسية تتجاوز المألوف.',
      en: 'A spatial acoustic column merging 360-degree precision acoustic engineering with an anodized aluminum and carbon-fiber monolithic chassis.'
    },
    metrics: {
      ar: 'نقاء صوتي 99.8% بمجال ترددي 18Hz - 42kHz',
      en: '99.8% acoustic fidelity across 18Hz - 42kHz'
    },
    image: '/src/assets/images/hero_soulx_monolith_1793489091169.jpg',
    details: {
      ar: [
        'معايرة صوتية ذاتية تتكيف مع أبعاد الغرفة في أقل من ثانيتين',
        'تشطيب مطفأ مضاد للبصمات مع إضاءة حافة خطية خافتة',
        'اتصال لا سلكي فائق فائق السرعة بزمن استجابة أقل من 4 ملي ثانية'
      ],
      en: [
        'Self-calibrating room resonance analysis in under 2 seconds',
        'Fingerprint-resistant matte finish with subtle linear perimeter illumination',
        'Ultra-low latency lossless audio streaming below 4ms'
      ]
    },
    specs: [
      { label: { ar: 'المواد', en: 'Materials' }, value: { ar: 'تيتانيوم مؤكسد، زجاج مصفى، صخور مصهورة', en: 'Anodized Titanium, Smoked Glass, Basalt' } },
      { label: { ar: 'النظام الصوتي', en: 'Acoustic Array' }, value: { ar: '6 مضخمات استريو هجينة بقدرة 450W', en: '6x Hybrid Class-D Amplifiers, 450W RMS' } },
      { label: { ar: 'التحكم', en: 'Control' }, value: { ar: 'استشعار سعوي حركي + تطبيق محيطي', en: 'Capacitive Proximity + Ambient Companion' } }
    ]
  },
  {
    id: 'aethera-form',
    title: {
      ar: 'Aethera Pure Form',
      en: 'Aethera Pure Form'
    },
    category: {
      ar: 'نحت مادي وتصميم حسي',
      en: 'Sensory Sculpture'
    },
    categoryKey: 'spatial',
    year: '2026',
    tagline: {
      ar: 'تناغم الزجاج المعتم والألمنيوم المصقول في تشكيل نقي',
      en: 'Interlocking smoked crystal and brushed aerospace aluminum'
    },
    description: {
      ar: 'منحوتة مكتبية تفاعلية تعيد صياغة العلاقة بين اللمس والسكينة في بيئات العمل الحديثة، مصممة بهندسة بصرية تريح الذهن وتضبط تدفق التركيز.',
      en: 'An interactive desktop kinetic sculpture harmonizing tactile presence and calm in modern creative spaces, engineered to anchor mental flow.'
    },
    metrics: {
      ar: 'إصدار محدود مرقم يدويًا لـ 150 قطعة حول العالم',
      en: 'Limited edition numbered series of 150 pieces worldwide'
    },
    image: '/src/assets/images/soulx_audio_spatial_1793489090595.jpg',
    details: {
      ar: [
        'توازن ميكانيكي دقيق بحسابات ذهبية دون أي مسامير ظاهرة',
        'ملمس ناعم معالج بتقنية النانو لراحة الحواس عند اللمس',
        'تفاعل ضوئي طبيعي مع زوايا الإضاءة المحيطة طوال اليوم'
      ],
      en: [
        'Precision mechanical balance utilizing golden ratio tolerances with zero exposed fasteners',
        'Nano-treated smooth tactile feel designed for restorative touch',
        'Dynamic refractive light interplay reacting to solar progression'
      ]
    },
    specs: [
      { label: { ar: 'الوزن الصافي', en: 'Net Weight' }, value: { ar: '2.4 كغ توازن استراتيجي', en: '2.4 kg precision counterweight' } },
      { label: { ar: 'الإنهاء السطحي', en: 'Surface Treatment' }, value: { ar: 'فرش يدوي ساتان 400-grit', en: 'Hand-brushed 400-grit satin' } },
      { label: { ar: 'الأصل', en: 'Origin' }, value: { ar: 'استوديو Soul-X للأعمال الخاصة', en: 'Soul-X Special Projects Atelier' } }
    ]
  },
  {
    id: 'nexus-interface',
    title: {
      ar: 'Nexus Glass Interface',
      en: 'Nexus Glass Interface'
    },
    category: {
      ar: 'واجهات رقمية ولمسية',
      en: 'Tactile Digital UI'
    },
    categoryKey: 'digital',
    year: '2025',
    tagline: {
      ar: 'منصة تحكم زجاجية تفاعلية للبيئات المعمارية الذكية',
      en: 'Tactile glass command console for architectural control'
    },
    description: {
      ar: 'واجهة تشغيل فائقة البساطة تدمج الزجاج الذكي مع استجابة ميكانيكية لمسية دقيقة وأقراص تدوير فيزيائية، للتحكم في الإضاءة والمناخ والصوت المعماري.',
      en: 'A minimalist control interface uniting capacitive smart glass, precision haptic feedback, and an analog aluminum dial for architectural environments.'
    },
    metrics: {
      ar: 'زمن استجابة لمسية 0.8ms مع دقة استشعار ميكرونية',
      en: '0.8ms haptic latency with micron-level rotary precision'
    },
    image: '/src/assets/images/soulx_digital_interface_1793489092983.jpg',
    details: {
      ar: [
        'شاشة عرض OLED مدمجة تحت الزجاج تختفي تماماً عند السكون',
        'قرص تدوير من التيتانيوم بمقاومة مغناطيسية متغيرة قابلة للبرمجة',
        'تكامل كامل مع بروتوكولات الأتمتة السكنية والتجارية العالمية'
      ],
      en: [
        'Under-glass micro-OLED panel that dissolves into pure darkness when idle',
        'Titanium rotary dial with programmable magnetic detent resistance',
        'Seamless integration with modern architectural building automation'
      ]
    },
    specs: [
      { label: { ar: 'الشاشة', en: 'Display' }, value: { ar: 'OLED مخصص مخفي بنفاذية 88%', en: 'Sub-surface stealth OLED, 88% transmittance' } },
      { label: { ar: 'التغذية المرتدة', en: 'Feedback' }, value: { ar: 'محرك كهرضغطي LRA ثنائي المحاور', en: 'Dual-axis piezoelectric LRA haptic engine' } },
      { label: { ar: 'الواجهة البرمجية', en: 'API Protocol' }, value: { ar: 'Soul-X Core Connect / REST / Matter', en: 'Soul-X Core Connect / REST / Matter' } }
    ]
  }
];

export const pillarsData: Pillar[] = [
  {
    number: '01',
    title: {
      ar: 'التجارب الرقمية الفاخرة',
      en: 'Bespoke Digital Experiences'
    },
    description: {
      ar: 'بناء واجهات ومنصات ويب فائقة السرعة تتنفس بالبساطة والجمال، حيث كل تفاعل يمنح شعوراً طبيعياً وسلساً للمستخدم.',
      en: 'Engineering web applications and digital flagships defined by speed, radical simplicity, and tactile motion.'
    },
    deliverable: {
      ar: 'واجهات مستخدم مخصصة، منصات تفاعلية، هويات رقمية متميزة',
      en: 'Custom web platforms, interactive showcases, design systems'
    }
  },
  {
    number: '02',
    title: {
      ar: 'تصميم المنتجات والأجهزة الحسية',
      en: 'Sensory Product & Industrial Design'
    },
    description: {
      ar: 'تشكيل منتجات مادية تحترم حواس الإنسان، من الأجهزة الصوتية الذكية إلى المنحوتات الحركية التي تدوم لأجيال.',
      en: 'Shaping physical hardware and tactile artifacts that respect human senses, from acoustic towers to serene desk objects.'
    },
    deliverable: {
      ar: 'التصميم الصناعي، هندسة المواد الفاخرة، نماذج الإنتاج الأولي',
      en: 'Industrial design, material engineering, precision prototypes'
    }
  },
  {
    number: '03',
    title: {
      ar: 'الهندسة الصوتية المكانية',
      en: 'Spatial Sonic Architecture'
    },
    description: {
      ar: 'تصميم مناظر صوتية وهوية سمعية تجعل الفضاءات والمنتجات تتكلم بهدوء ووقار دون ضجيج أو تشتيت.',
      en: 'Composing soundscapes and acoustic brand identities that allow spaces and products to communicate with quiet confidence.'
    },
    deliverable: {
      ar: 'الهوية السمعية للعلامات، المؤثرات اللمسية الصوتية، بيئات الصوت المحيطي',
      en: 'Acoustic brand identity, micro-sound UX, ambient soundscapes'
    }
  },
  {
    number: '04',
    title: {
      ar: 'استشارات الابتكار والجماليات',
      en: 'Aesthetic Direction & Strategy'
    },
    description: {
      ar: 'توجيه العلامات الطموحة نحو لغة تصميم فريدة تبتعد عن القوالب المكررة وتؤسس لأصالة مستدامة.',
      en: 'Guiding visionary founders and premium brands to forge an unmistakable visual signature and timeless posture.'
    },
    deliverable: {
      ar: 'استراتيجية الهوية، التوجيه الفني الكامل، فلسفة التصميم المستقلة',
      en: 'Brand philosophy, creative art direction, sensory brand books'
    }
  }
];

export const statsData = [
  {
    value: '14+',
    label: {
      ar: 'جائزة تصميم عالمية مرموقة',
      en: 'Global Design Accolades'
    },
    subtext: {
      ar: 'تكريم في برلين وطوكيو ولندن',
      en: 'Recognized in Berlin, Tokyo & London'
    }
  },
  {
    value: '99.4%',
    label: {
      ar: 'دقة المطابقة الهندسية',
      en: 'Engineering Fidelity Rate'
    },
    subtext: {
      ar: 'بين المفهوم الأولي والمنتج النهائي',
      en: 'From concept to realized product'
    }
  },
  {
    value: '42',
    label: {
      ar: 'مشروعاً أُطلق في 12 دولة',
      en: 'Projects Realized Globally'
    },
    subtext: {
      ar: 'لعملاء يبحثون عن التميّز الفريد',
      en: 'For clients demanding distinction'
    }
  },
  {
    value: '< 1s',
    label: {
      ar: 'سرعة استجابة التجارب الرقمية',
      en: 'Average Visual Latency'
    },
    subtext: {
      ar: 'أداء فائق مع تفاعلات بصرية نقية',
      en: 'Zero bloat, pure fluid interaction'
    }
  }
];
