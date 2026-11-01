import React, { useState } from 'react';
import { Language } from '../types';
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from 'lucide-react';

interface ContactSectionProps {
  lang: Language;
  initialSubject?: string;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  lang,
  initialSubject = '',
}) => {
  const isAr = lang === 'ar';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<'hardware' | 'digital' | 'bespoke'>('hardware');
  const [message, setMessage] = useState(initialSubject ? `Inquiry regarding: ${initialSubject}` : '');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validate = () => {
    const errs: { name?: string; email?: string } = {};
    if (!name.trim()) {
      errs.name = isAr ? 'يرجى إدخال اسمك أو اسم المؤسسة' : 'Please provide your name or organization';
    }
    if (!email.trim() || !email.includes('@')) {
      errs.email = isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <section id="contact" className="py-24 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto mb-16">
          <div className="text-xs uppercase tracking-widest text-cyan-500 font-semibold mb-3">
            {isAr ? 'بدء التعاون الإبداعي' : 'Collaborate With Us'}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white mb-4">
            {isAr ? 'دعنا نصنع شيئاً يخلّد في الذاكرة' : 'Let us create something timeless.'}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {isAr
              ? 'نقبل عدداً محدوداً من المشاريع سنوياً لضمان أعلى مستويات التركيز الهندسي والفني.'
              : 'We accept a strictly limited commission capacity annually to preserve absolute focus on engineering craft.'}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl transition-all">
          {isSubmitted ? (
            <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                {isAr ? 'تم استلام طلبك بنجاح' : 'Inquiry Received'}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
                {isAr
                  ? `شكراً لتواصلك يا ${name}. سيقوم أحد الشركاء المؤسسين في Soul-X بالرد عليك خلال 24 ساعة عبر ${email}.`
                  : `Thank you, ${name}. A founding partner at Soul-X will reach out personally within 24 hours at ${email}.`}
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-colors"
                >
                  {isAr ? 'إرسال استفسار آخر' : 'Send Another Inquiry'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Segmented Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                  {isAr ? 'نوع المشروع أو الاهتمام' : 'Discipline of Interest'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('hardware')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-center whitespace-nowrap ${
                      category === 'hardware'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {isAr ? 'أجهزة وتصميم صناعي' : 'Hardware & Objects'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('digital')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-center whitespace-nowrap ${
                      category === 'digital'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {isAr ? 'تجارب ومنصات رقمية' : 'Digital Flagships'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('bespoke')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-center whitespace-nowrap ${
                      category === 'bespoke'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {isAr ? 'مشروع مخصص خاص' : 'Bespoke Commission'}
                  </button>
                </div>
              </div>

              {/* Name & Email 2-column input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {isAr ? 'الاسم الكامل أو المؤسسة' : 'Full Name or Atelier'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: undefined });
                    }}
                    placeholder={isAr ? 'مثال: كريم المنصور' : 'e.g. Elena Vance'}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-950/70 border ${
                      errors.name
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-neutral-200 dark:border-neutral-800 focus:border-cyan-500'
                    } text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors`}
                  />
                  {errors.name && (
                    <span className="text-xs text-red-500 mt-1 block">{errors.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    placeholder={isAr ? 'name@company.com' : 'partner@studio.com'}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-950/70 border ${
                      errors.email
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-neutral-200 dark:border-neutral-800 focus:border-cyan-500'
                    } text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors`}
                  />
                  {errors.email && (
                    <span className="text-xs text-red-500 mt-1 block">{errors.email}</span>
                  )}
                </div>
              </div>

              {/* Project Brief textarea */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {isAr ? 'نبذة عن المشروع أو التطلعات' : 'Project Vision & Scope'}
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isAr
                      ? 'شاركنا الفكرة الرئيسية، الإطار الزمني المتوقع، والتطلعات البصرية...'
                      : 'Outline the core concept, timeline, and aesthetic objectives...'
                  }
                  className="w-full px-4 py-3 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {isAr ? 'سرية تامة ورد هندسي مباشر خلال 24 ساعة' : 'Direct partner response under 24h'}
                </span>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إرسال طلب التعاون' : 'Transmit Brief'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
