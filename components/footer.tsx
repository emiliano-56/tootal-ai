export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="py-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-sm text-muted-foreground">
          © {currentYear} ComicTale AI. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
