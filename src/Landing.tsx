import { Check, DraftingCompass, FolderClosed, Globe2, Layers3, ListTodo, Sun, Users } from 'lucide-react';
import { useApp } from './context';
import { Building } from './components';
import './landing.css';

export function Landing() {
  const { lang, setLang, setTheme, navigate, studio } = useApp();
  const ar = lang === 'ar';
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const demo = () => { studio.enterDemo(); navigate('/overview'); };
  return <div className="landing">
    <a className="skip-link" href="#landing-main" onClick={e => { e.preventDefault(); document.getElementById('landing-main')?.focus(); }}>{copy('Skip to content', 'تخطَّ إلى المحتوى')}</a>
    <header className="landing-nav">
      <a href="#/welcome" className="brand"><span className="brand-symbol"><DraftingCompass size={24}/></span><span>archi<span className="brand-light">flow</span></span></a>
      <div className="landing-actions">
        <button className="icon-button" aria-label={copy('Change theme', 'تغيير السمة')} onClick={() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')}><Sun size={19}/></button>
        <button className="language-button" onClick={() => setLang(ar ? 'en' : 'ar')}><Globe2 size={17}/>{ar ? 'English' : 'العربية'}</button>
        <a className="button secondary" href="#/signin">{copy('Sign in', 'تسجيل الدخول')}</a>
      </div>
    </header>
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-hero">
        <div>
          <p className="landing-eyebrow">{copy('A shared workspace for architecture studios', 'مساحة عمل مشتركة للاستوديوهات المعمارية')}</p>
          <h1>{copy('Make room for the work you love.', 'مساحة أكبر للعمل الذي تحبّه.')}</h1>
          <p className="landing-intro">{copy('Bring projects, phases, people, and deadlines into one considered workspace. From your first sketch to the final handover.', 'اجمع المشروعات والمراحل والفريق والمواعيد في مساحة عمل مدروسة، من الرسم الأول إلى التسليم النهائي.')}</p>
          <div className="landing-cta"><a className="button primary" href="#/signup">{copy('Create your studio', 'أنشئ استوديوك')}</a><button className="button secondary" onClick={demo}>{copy('Explore the demo', 'استكشف النسخة التجريبية')}</button></div>
          <p className="landing-caption">{copy('The demo stays in your browser. Create an account for shared team projects.', 'تبقى التجربة في متصفحك. أنشئ حسابًا لمشاركة المشروعات مع فريقك.')}</p>
        </div>
        <div className="landing-image"><Building variant={0} eager/><div className="landing-image-note"><Layers3 size={20}/><span>{copy('From concept to handover', 'من الفكرة إلى التسليم')}<small>{copy('Every phase, one shared plan.', 'كل المراحل ضمن خطة مشتركة.')}</small></span></div></div>
      </section>
      <section className="landing-section" aria-labelledby="features-heading">
        <p className="landing-eyebrow">{copy('A clearer working day', 'يوم عمل أكثر وضوحًا')}</p>
        <h2 id="features-heading">{copy('Less searching. More designing.', 'بحث أقل. تصميم أكثر.')}</h2>
        <div className="landing-features">{[
          { Icon: FolderClosed, title: copy('A home for every project', 'مساحة لكل مشروع'), body: copy('Keep the brief, phases, notes, and reference links together.', 'اجمع موجز المشروع ومراحله وملاحظاته وروابطه المرجعية.') },
          { Icon: ListTodo, title: copy('Know the next step', 'اعرف الخطوة القادمة'), body: copy('Assign tasks, track deadlines, and switch between phase lists and a status board.', 'وزّع المهام وتابع المواعيد عبر قوائم المراحل ولوحة الحالات.') },
          { Icon: Users, title: copy('Work as a studio', 'اعمل كفريق'), body: copy('Invite your team to private studio projects with discussion and activity history.', 'ادعُ فريقك إلى مشروعات الاستوديو الخاصة مع النقاشات وسجل النشاط.') },
        ].map(({ Icon, title, body }) => <article key={title}><span className="landing-feature-icon"><Icon size={24}/></span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>
      <section className="landing-section landing-pricing" aria-labelledby="pricing-heading">
        <div><p className="landing-eyebrow">{copy('Start together', 'ابدؤوا معًا')}</p><h2 id="pricing-heading">{copy('Free early access.', 'وصول مبكر مجاني.')}</h2><p>{copy('Explore Archiflow with your studio. Paid plans and billing are not available yet.', 'استكشف آركي فلو مع استوديوك. الخطط المدفوعة والفوترة غير متاحة حاليًا.')}</p></div>
        <article className="landing-plan"><h3>{copy('Studio workspace', 'مساحة الاستوديو')}</h3><ul>{[copy('Projects, phases, and task boards', 'المشروعات والمراحل ولوحات المهام'), copy('Team invitations and project discussions', 'دعوات الفريق ونقاشات المشروعات'), copy('English, Arabic, and dark mode', 'العربية والإنجليزية والوضع الداكن')].map(item => <li key={item}><Check size={18}/>{item}</li>)}</ul><a className="button primary" href="#/signup">{copy('Get started', 'ابدأ الآن')}</a></article>
      </section>
    </main>
    <footer className="landing-footer"><span>Archiflow</span><p>{copy('A considered space for your studio.', 'مساحة مدروسة لاستوديوك.')}</p><a href="#/signin">{copy('Open your workspace', 'افتح مساحة عملك')}</a></footer>
  </div>;
}
