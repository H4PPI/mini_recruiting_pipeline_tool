export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 px-6 py-3">
      <p className="text-white/40 text-xs text-center">
        © {new Date().getFullYear()} RecruitPipeline. All rights reserved.
      </p>
    </footer>
  );
}
