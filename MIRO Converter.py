import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinterdnd2 import DND_FILES, TkinterDnD
from pdf2image import convert_from_path
import os
import sys
from pathlib import Path

# Mapping (Page Size, Orientation, Scale) -> Target Pixel Width
PIXEL_WIDTHS = {
    ("A3", "Landscape", "1:100"): 4180,
    ("A3", "Landscape", "1:50") : 2090,
    ("A3", "Landscape", "1:25") : 1045,
    ("A3", "Landscape", "1:20") : 836,
    ("A4", "Landscape", "1:100"): 2968,
    ("A4", "Landscape", "1:50") : 1484,
    ("A4", "Landscape", "1:25") : 742,
    ("A4", "Landscape", "1:20") : 591,
    ("A3", "Portrait",  "1:100"): 4180,
    ("A3", "Portrait",  "1:50") : 1484,
    ("A3", "Portrait",  "1:25") : 742,
    ("A3", "Portrait",  "1:20") : 594,
    ("A4", "Portrait",  "1:100"): 2098,
    ("A4", "Portrait",  "1:50") : 1049,
    ("A4", "Portrait",  "1:25") : 525,
    ("A4", "Portrait",  "1:20") : 420,

}


def get_unique_filename(base_path):
    counter = 1
    new_path = base_path
    while new_path.exists():
        new_path = base_path.with_name(f"{base_path.stem} ({counter}){base_path.suffix}")
        counter += 1
    return new_path


class PDFConverterApp:
    def __init__(self, master, initial_file=None):
        self.master = master
        master.title("PDF to JPEG Scaler")
        self.pdf_files = [initial_file] if initial_file else []

        # Center window
        w, h = 500, 400
        ws = master.winfo_screenwidth()
        hs = master.winfo_screenheight()
        master.geometry(f"{w}x{h}+{(ws - w) // 2}+{(hs - h) // 2}")

        self.frame = ttk.Frame(master, padding="20")
        self.frame.pack(expand=True)

        master.drop_target_register(DND_FILES)
        master.dnd_bind('<<Drop>>', self.on_drop)

        self.file_button = ttk.Button(self.frame, text="Select or Drag PDF File(s) Here", command=self.select_files, width=40)
        self.file_button.pack(pady=20)

        ttk.Label(self.frame, text="Page Size:").pack(anchor='center')
        self.page_size = tk.StringVar(value="A3")
        ttk.OptionMenu(self.frame, self.page_size, "A3", "A3", "A4").pack(pady=5)

        ttk.Label(self.frame, text="Drawing Scale:").pack(anchor='center')
        self.scale = tk.StringVar(value="1:100")
        ttk.OptionMenu(self.frame, self.scale, "1:100", "1:100", "1:50", "1:20", "1:25").pack(pady=5)

        ttk.Label(self.frame, text="Orientation:").pack(anchor='center')
        self.orientation = tk.StringVar(value="Landscape")
        ttk.OptionMenu(self.frame, self.orientation, "Landscape", "Landscape", "Portrait").pack(pady=5)

        style = ttk.Style()
        style.configure("Blue.TButton", font=("Arial", 14, "bold"), foreground="black", background="#0078D7")
        style.map("Blue.TButton", background=[("active", "#005BA1")])

        self.process_button = ttk.Button(self.frame, text="Process", style="Blue.TButton", command=self.process_pdf)
        self.process_button.pack(pady=30)
        self.process_button.focus_set()
        master.bind('<Return>', lambda e: self.process_pdf())

        if self.pdf_files:
            self.file_button.config(text=", ".join(os.path.basename(f) for f in self.pdf_files))

    def select_files(self):
        selected_files = filedialog.askopenfilenames(filetypes=[("PDF Files", "*.pdf")])
        if selected_files:
            self.pdf_files = selected_files
            self.file_button.config(text=", ".join(os.path.basename(f) for f in self.pdf_files))

    def on_drop(self, event):
        files = self.master.tk.splitlist(event.data)
        pdf_files = [f for f in files if f.lower().endswith('.pdf')]
        if pdf_files:
            self.pdf_files = pdf_files
            self.file_button.config(text=", ".join(os.path.basename(f) for f in self.pdf_files))
        else:
            messagebox.showerror("Error", "Please drop one or more PDF files.")

    def process_pdf(self):
        if not self.pdf_files:
            messagebox.showerror("Error", "Please select or drop one or more PDF files first.")
            return

        key = (self.page_size.get(), self.orientation.get(), self.scale.get())
        pixel_width = PIXEL_WIDTHS.get(key)
        if not pixel_width:
            messagebox.showerror("Error", f"No scaling rule for {key}")
            return

        try:
            output_dir = Path.home() / "Downloads"
            total_pages = 0

            for pdf_file in self.pdf_files:
                pages = convert_from_path(pdf_file, dpi=300)
                base_name = Path(pdf_file).stem
                multi_page = len(pages) > 1

                for i, page in enumerate(pages):
                    aspect_ratio = page.height / page.width
                    new_height = int(pixel_width * aspect_ratio)
                    resized = page.resize((pixel_width, new_height))

                    if multi_page:
                        base_output_name = f"{base_name}_page{i+1}.jpg"
                    else:
                        base_output_name = f"{base_name}.jpg"

                    out_path = output_dir / base_output_name
                    out_path = get_unique_filename(out_path)
                    resized.save(out_path, "JPEG")
                    total_pages += 1

            messagebox.showinfo("Success", f"Saved {total_pages} JPEG(s) to Downloads folder.")

        except Exception as e:
            messagebox.showerror("Error", str(e))


if __name__ == "__main__":
    pdf_args = [arg for arg in sys.argv[1:] if arg.lower().endswith('.pdf')]
    root = TkinterDnD.Tk()
    root.lift()
    root.attributes('-topmost', True)
    root.after_idle(root.attributes, '-topmost', False)
    app = PDFConverterApp(root, initial_file=pdf_args[0] if pdf_args else None)
    root.mainloop()
